-- Smart Entry — aprendizado confirmado
-- Tabela aditiva; não altera gastos nem contratos existentes.

CREATE TABLE IF NOT EXISTS public.smart_entry_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_normalizado text NOT NULL,
  categoria text NOT NULL,
  confirmacoes integer NOT NULL DEFAULT 1,
  manual boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smart_entry_rules_term_chk CHECK (char_length(termo_normalizado) BETWEEN 2 AND 120),
  CONSTRAINT smart_entry_rules_category_chk CHECK (categoria IN ('Mercado','Contas','Aluguel','Ifood','Outros')),
  CONSTRAINT smart_entry_rules_confirmations_chk CHECK (confirmacoes >= 0),
  CONSTRAINT smart_entry_rules_term_category_key UNIQUE (termo_normalizado, categoria),
  CONSTRAINT smart_entry_rules_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.household_members(auth_user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

ALTER TABLE public.smart_entry_rules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.smart_entry_rules FROM public, anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_entry_rules TO authenticated;

DROP POLICY IF EXISTS smart_entry_rules_auth_select ON public.smart_entry_rules;
CREATE POLICY smart_entry_rules_auth_select ON public.smart_entry_rules
FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS smart_entry_rules_auth_insert ON public.smart_entry_rules;
CREATE POLICY smart_entry_rules_auth_insert ON public.smart_entry_rules
FOR INSERT TO authenticated
WITH CHECK (public.is_household_member() AND created_by = auth.uid());

DROP POLICY IF EXISTS smart_entry_rules_auth_update ON public.smart_entry_rules;
CREATE POLICY smart_entry_rules_auth_update ON public.smart_entry_rules
FOR UPDATE TO authenticated
USING (public.is_household_member())
WITH CHECK (public.is_household_member());

DROP POLICY IF EXISTS smart_entry_rules_auth_delete ON public.smart_entry_rules;
CREATE POLICY smart_entry_rules_auth_delete ON public.smart_entry_rules
FOR DELETE TO authenticated
USING (public.is_household_member());

CREATE INDEX IF NOT EXISTS smart_entry_rules_active_term_idx
ON public.smart_entry_rules (ativo, termo_normalizado, manual DESC, confirmacoes DESC);

CREATE UNIQUE INDEX IF NOT EXISTS smart_entry_rules_one_manual_term_idx
ON public.smart_entry_rules (termo_normalizado)
WHERE manual = true AND ativo = true;

NOTIFY pgrst, 'reload schema';
