-- Additive migration. Run as the application owner in an isolated branch first.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Execute como proprietário sem SUPERUSER/BYPASSRLS.';
 END IF;
END $$;
CREATE TABLE public.expense_requests (
 owner_id uuid NOT NULL REFERENCES public.household_members(auth_user_id),
 request_key text NOT NULL CHECK(request_key ~ '^[a-zA-Z0-9_-]{8,120}$'),
 payload jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,request_key)
);
ALTER TABLE public.expense_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_requests FROM public,anonymous,authenticated;
GRANT SELECT ON public.expense_requests TO authenticated;
CREATE POLICY expense_requests_owner ON public.expense_requests FOR SELECT TO authenticated
 USING(owner_id=auth.uid() AND public.is_household_member());
CREATE FUNCTION public.record_expense(p_data date,p_valor numeric,p_descricao text,p_categoria text,p_forma_pagamento text,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 v_owner uuid:=auth.uid(); v_name text:=public.current_app_user_name();
 v_payload jsonb; v_existing public.expense_requests%ROWTYPE; v_saved public.gastos%ROWTYPE;
BEGIN
 IF v_owner IS NULL OR NOT public.is_household_member() OR v_name IS NULL OR btrim(v_name)='' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sessão sem autorização para despesas.';
 END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Refaça em nova transação.';
 END IF;
 IF p_data IS NULL OR NOT isfinite(p_data) OR p_valor IS NULL OR p_valor::text IN ('NaN','Infinity','-Infinity')
 OR p_valor<=0 OR p_valor>9999999999.99 OR p_valor*100<>trunc(p_valor*100)
 OR p_descricao IS NULL OR length(btrim(p_descricao)) NOT BETWEEN 1 AND 500
 OR p_categoria IS NULL OR p_categoria NOT IN ('Mercado','Contas','Aluguel','Ifood','Outros')
 OR p_forma_pagamento IS NULL OR p_forma_pagamento NOT IN ('Dinheiro','Vale')
 OR p_request_key IS NULL OR p_request_key !~ '^[a-zA-Z0-9_-]{8,120}$' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Dados de despesa inválidos.';
 END IF;
 v_payload:=jsonb_build_object('data',p_data,'valor',p_valor,'descricao',btrim(p_descricao),'categoria',p_categoria,'metodo',p_forma_pagamento);
 PERFORM pg_advisory_xact_lock(hashtextextended('gastos-expense-request:'||v_owner::text||':'||p_request_key,0));
 SELECT * INTO v_existing FROM public.expense_requests WHERE owner_id=v_owner AND request_key=p_request_key;
 IF FOUND THEN
  IF v_existing.payload<>v_payload THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Chave já utilizada com outra despesa.'; END IF;
  RETURN jsonb_build_object('expense',v_existing.result,'replayed',true);
 END IF;
 INSERT INTO public.gastos(data,usuario,valor,descricao,categoria,forma_pagamento)
 VALUES(p_data,v_name,p_valor,btrim(p_descricao),p_categoria,p_forma_pagamento) RETURNING * INTO v_saved;
 INSERT INTO public.expense_requests(owner_id,request_key,payload,result) VALUES(v_owner,p_request_key,v_payload,to_jsonb(v_saved));
 RETURN jsonb_build_object('expense',to_jsonb(v_saved),'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.record_expense(date,numeric,text,text,text,text) FROM public,anonymous;
GRANT EXECUTE ON FUNCTION public.record_expense(date,numeric,text,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
