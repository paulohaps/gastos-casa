BEGIN;
CREATE TABLE public.private_ai_settings (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid(),
  provider text NOT NULL CHECK (provider IN ('gemini', 'deepseek')),
  model text NOT NULL CHECK (model ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$'),
  key_ciphertext text NOT NULL CHECK (length(key_ciphertext) BETWEEN 40 AND 1024),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.private_ai_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_ai_settings FROM public, anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_ai_settings TO authenticated;
CREATE POLICY private_ai_settings_owner ON public.private_ai_settings FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.is_household_member())
  WITH CHECK (owner_id = auth.uid() AND public.is_household_member());
NOTIFY pgrst, 'reload schema';
COMMIT;
