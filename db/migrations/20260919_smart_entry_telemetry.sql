-- Smart Entry — telemetria de qualidade sem texto bruto
-- Tabela aditiva; não altera gastos nem armazena o texto original do usuário.

CREATE TABLE IF NOT EXISTS public.smart_entry_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  intent text NOT NULL DEFAULT 'expense',
  parser_version text NOT NULL,
  needs_review boolean NOT NULL DEFAULT true,
  warnings_count integer NOT NULL DEFAULT 0,
  category_source text,
  category_confidence numeric(4,3),
  value_confidence numeric(4,3),
  description_confidence numeric(4,3),
  payment_confidence numeric(4,3),
  date_confidence numeric(4,3),
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  confirmation_ms integer,
  corrected_value boolean,
  corrected_description boolean,
  corrected_category boolean,
  corrected_payment boolean,
  corrected_date boolean,
  learning_recorded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smart_entry_telemetry_intent_chk CHECK (intent IN ('expense','unsupported')),
  CONSTRAINT smart_entry_telemetry_warnings_chk CHECK (warnings_count >= 0),
  CONSTRAINT smart_entry_telemetry_confirmation_ms_chk CHECK (confirmation_ms IS NULL OR confirmation_ms >= 0),
  CONSTRAINT smart_entry_telemetry_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.household_members(auth_user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

ALTER TABLE public.smart_entry_telemetry ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.smart_entry_telemetry FROM public, anonymous;
GRANT SELECT, INSERT, UPDATE ON public.smart_entry_telemetry TO authenticated;

DROP POLICY IF EXISTS smart_entry_telemetry_auth_select ON public.smart_entry_telemetry;
CREATE POLICY smart_entry_telemetry_auth_select ON public.smart_entry_telemetry
FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS smart_entry_telemetry_auth_insert ON public.smart_entry_telemetry;
CREATE POLICY smart_entry_telemetry_auth_insert ON public.smart_entry_telemetry
FOR INSERT TO authenticated
WITH CHECK (public.is_household_member() AND created_by = auth.uid());

DROP POLICY IF EXISTS smart_entry_telemetry_auth_update ON public.smart_entry_telemetry;
CREATE POLICY smart_entry_telemetry_auth_update ON public.smart_entry_telemetry
FOR UPDATE TO authenticated
USING (public.is_household_member() AND created_by = auth.uid())
WITH CHECK (public.is_household_member() AND created_by = auth.uid());

CREATE INDEX IF NOT EXISTS smart_entry_telemetry_created_at_idx
ON public.smart_entry_telemetry (created_at DESC);

CREATE INDEX IF NOT EXISTS smart_entry_telemetry_confirmed_idx
ON public.smart_entry_telemetry (confirmed, created_at DESC);

NOTIFY pgrst, 'reload schema';
