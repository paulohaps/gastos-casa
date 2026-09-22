-- Acertos parciais e quitação por competência, separados das despesas.
CREATE TABLE IF NOT EXISTS public.acertos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  data_pagamento date NOT NULL,
  pagador text NOT NULL,
  recebedor text NOT NULL,
  forma_pagamento text NOT NULL,
  valor numeric(12,2) NOT NULL,
  observacao text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acertos_competencia_primeiro_dia_chk CHECK (extract(day FROM competencia) = 1),
  CONSTRAINT acertos_partes_distintas_chk CHECK (pagador <> recebedor),
  CONSTRAINT acertos_forma_pagamento_chk CHECK (forma_pagamento IN ('Dinheiro', 'Vale')),
  CONSTRAINT acertos_valor_positivo_chk CHECK (valor > 0),
  CONSTRAINT acertos_observacao_tamanho_chk CHECK (char_length(observacao) <= 240),
  CONSTRAINT acertos_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.household_members(auth_user_id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS acertos_competencia_idx
  ON public.acertos (competencia, forma_pagamento, data_pagamento DESC);

ALTER TABLE public.acertos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acertos FROM public, anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acertos TO authenticated;

DROP POLICY IF EXISTS acertos_auth_select ON public.acertos;
CREATE POLICY acertos_auth_select ON public.acertos FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS acertos_auth_insert ON public.acertos;
CREATE POLICY acertos_auth_insert ON public.acertos FOR INSERT TO authenticated
WITH CHECK (
  public.is_household_member()
  AND created_by = auth.uid()
  AND pagador = public.current_app_user_name()
  AND recebedor <> public.current_app_user_name()
);

DROP POLICY IF EXISTS acertos_auth_update ON public.acertos;
CREATE POLICY acertos_auth_update ON public.acertos FOR UPDATE TO authenticated
USING (public.is_household_member()) WITH CHECK (public.is_household_member());

DROP POLICY IF EXISTS acertos_auth_delete ON public.acertos;
CREATE POLICY acertos_auth_delete ON public.acertos FOR DELETE TO authenticated
USING (public.is_household_member());

CREATE OR REPLACE FUNCTION public.prevent_acerto_identity_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.competencia IS DISTINCT FROM OLD.competencia
     OR NEW.pagador IS DISTINCT FROM OLD.pagador
     OR NEW.recebedor IS DISTINCT FROM OLD.recebedor
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A identidade do acerto não pode ser alterada.';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS acertos_identity_immutable ON public.acertos;
CREATE TRIGGER acertos_identity_immutable
BEFORE UPDATE ON public.acertos FOR EACH ROW
EXECUTE FUNCTION public.prevent_acerto_identity_change();
