-- Additive migration; no financial history is rewritten.
BEGIN;
CREATE TABLE IF NOT EXISTS public.settlement_requests (
  owner_id uuid NOT NULL REFERENCES public.household_members(auth_user_id),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 120),
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, request_key)
);
ALTER TABLE public.settlement_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.settlement_requests FROM public, anonymous, authenticated;
GRANT SELECT ON public.settlement_requests TO authenticated;
CREATE POLICY settlement_requests_owner ON public.settlement_requests FOR SELECT TO authenticated
USING (owner_id = auth.uid() AND public.is_household_member());

-- One lock namespace for all mutations affecting a period/method balance.
CREATE OR REPLACE FUNCTION public.lock_financial_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE old_key text; new_key text; period_key text;
BEGIN
  IF TG_TABLE_NAME = 'gastos' THEN
    IF TG_OP <> 'INSERT' THEN old_key := to_char(OLD.data::date, 'YYYY-MM') || ':' || coalesce(OLD.forma_pagamento, 'Dinheiro'); END IF;
    IF TG_OP <> 'DELETE' THEN new_key := to_char(NEW.data::date, 'YYYY-MM') || ':' || coalesce(NEW.forma_pagamento, 'Dinheiro'); END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN old_key := to_char(OLD.competencia, 'YYYY-MM') || ':' || OLD.forma_pagamento; END IF;
    IF TG_OP <> 'DELETE' THEN new_key := to_char(NEW.competencia, 'YYYY-MM') || ':' || NEW.forma_pagamento; END IF;
  END IF;
  FOR period_key IN SELECT DISTINCT k FROM unnest(ARRAY[old_key,new_key]) AS k WHERE k IS NOT NULL ORDER BY k LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('gastos-period:' || period_key, 0));
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_financial_period() FROM public, anonymous, authenticated;
CREATE TRIGGER gastos_financial_lock BEFORE INSERT OR UPDATE OR DELETE ON public.gastos
FOR EACH ROW EXECUTE FUNCTION public.lock_financial_period();
CREATE TRIGGER acertos_financial_lock BEFORE INSERT OR UPDATE OR DELETE ON public.acertos
FOR EACH ROW EXECUTE FUNCTION public.lock_financial_period();

CREATE OR REPLACE FUNCTION public.record_settlement(
  p_competencia date, p_data_pagamento date, p_recebedor text,
  p_forma_pagamento text, p_valor numeric, p_observacao text, p_request_key text
) RETURNS SETOF public.acertos LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_owner_id uuid := auth.uid(); payer text := public.current_app_user_name();
  payload jsonb; existing public.settlement_requests%ROWTYPE; saved public.acertos%ROWTYPE;
  ph numeric; fernando numeric; total numeric; signed_balance numeric; transferred numeric;
  debtor text; creditor text; unknown_count bigint;
BEGIN
  IF v_owner_id IS NULL OR NOT public.is_household_member() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Sessão sem autorização para acertos.';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Refaça a operação em uma nova transação.';
  END IF;
  IF p_competencia IS NULL OR extract(day FROM p_competencia) <> 1
    OR p_data_pagamento IS NULL OR p_forma_pagamento IS NULL OR p_forma_pagamento NOT IN ('Dinheiro','Vale')
    OR p_valor IS NULL OR p_valor <= 0 OR p_valor > 9999999999.99 OR p_valor*100 <> trunc(p_valor*100)
    OR p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 120
    OR length(coalesce(p_observacao,'')) > 240 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Dados de pagamento inválidos.';
  END IF;
  IF payer IS NULL OR payer NOT IN ('Paulo Henrique','Fernando Gustavo') OR p_recebedor IS NULL
    OR p_recebedor NOT IN ('Paulo Henrique','Fernando Gustavo') OR payer = p_recebedor THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Participantes de acerto inválidos.';
  END IF;
  payload := jsonb_build_object('competencia',p_competencia,'data',p_data_pagamento,'pagador',payer,
    'recebedor',p_recebedor,'metodo',p_forma_pagamento,'valor',p_valor,'observacao',coalesce(p_observacao,''));
  PERFORM pg_advisory_xact_lock(hashtextextended('gastos-request:' || v_owner_id::text || ':' || p_request_key,0));
  SELECT * INTO existing FROM public.settlement_requests r WHERE r.owner_id=v_owner_id AND r.request_key=p_request_key;
  IF FOUND THEN
    IF existing.payload <> payload THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Chave já utilizada com outro pagamento.'; END IF;
    RETURN QUERY SELECT * FROM jsonb_populate_record(NULL::public.acertos,existing.result);
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gastos-period:' || to_char(p_competencia,'YYYY-MM') || ':' || p_forma_pagamento,0));
  SELECT coalesce(sum(valor*100) FILTER(WHERE usuario='Paulo Henrique'),0),
    coalesce(sum(valor*100) FILTER(WHERE usuario='Fernando Gustavo'),0),
    count(*) FILTER(WHERE usuario IS NULL OR usuario NOT IN ('Paulo Henrique','Fernando Gustavo') OR valor IS NULL OR valor<0 OR valor*100<>trunc(valor*100))
    INTO ph,fernando,unknown_count FROM public.gastos
    WHERE data>=p_competencia AND data<(p_competencia + interval '1 month') AND coalesce(forma_pagamento,'Dinheiro')=p_forma_pagamento;
  IF unknown_count > 0 THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Existem despesas sem regra de divisão válida.'; END IF;
  total := ph+fernando;
  SELECT coalesce(sum(CASE WHEN pagador='Fernando Gustavo' AND recebedor='Paulo Henrique' THEN valor*100
    WHEN pagador='Paulo Henrique' AND recebedor='Fernando Gustavo' THEN -valor*100 ELSE 0 END),0),
    count(*) FILTER(WHERE pagador NOT IN ('Paulo Henrique','Fernando Gustavo') OR recebedor NOT IN ('Paulo Henrique','Fernando Gustavo') OR valor*100<>trunc(valor*100))
    INTO transferred,unknown_count FROM public.acertos WHERE competencia=p_competencia AND forma_pagamento=p_forma_pagamento;
  IF unknown_count > 0 THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Existem pagamentos sem regra de divisão válida.'; END IF;
  signed_balance := ph-ceil(total/2)-transferred;
  IF total>9007199254740991 OR abs(transferred)>9007199254740991 OR abs(signed_balance)>9007199254740991 THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Saldo fora do limite seguro de cálculo.';
  END IF;
  debtor := CASE WHEN signed_balance>0 THEN 'Fernando Gustavo' ELSE 'Paulo Henrique' END;
  creditor := CASE WHEN signed_balance>0 THEN 'Paulo Henrique' ELSE 'Fernando Gustavo' END;
  IF signed_balance=0 THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Competência já quitada.'; END IF;
  IF payer<>debtor OR p_recebedor<>creditor THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='O acerto deve ser registrado pelo devedor atual para o credor atual.';
  END IF;
  IF p_valor*100>abs(signed_balance) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='O valor supera o saldo restante.',
      DETAIL=jsonb_build_object('remaining',abs(signed_balance)/100)::text;
  END IF;
  INSERT INTO public.acertos(competencia,data_pagamento,pagador,recebedor,forma_pagamento,valor,observacao,created_by)
    VALUES(p_competencia,p_data_pagamento,payer,p_recebedor,p_forma_pagamento,p_valor,nullif(p_observacao,''),v_owner_id) RETURNING * INTO saved;
  INSERT INTO public.settlement_requests(owner_id,request_key,payload,result) VALUES(v_owner_id,p_request_key,payload,to_jsonb(saved));
  RETURN NEXT saved;
END;
$$;
REVOKE ALL ON FUNCTION public.record_settlement(date,date,text,text,numeric,text,text) FROM public, anonymous;
GRANT EXECUTE ON FUNCTION public.record_settlement(date,date,text,text,numeric,text,text) TO authenticated;
-- The RPC validates membership and identity explicitly; older writers fail closed.
REVOKE INSERT, UPDATE ON public.acertos FROM authenticated;
CREATE OR REPLACE FUNCTION public.settlement_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public
AS $$ SELECT jsonb_build_object('atomic',true,'policy','cents-v1') WHERE public.is_household_member() $$;
REVOKE ALL ON FUNCTION public.settlement_capabilities() FROM public, anonymous;
GRANT EXECUTE ON FUNCTION public.settlement_capabilities() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
