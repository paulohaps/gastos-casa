-- Round 5: fiscal receipt imports.
-- Additive metadata table; receipt image and OCR text are NOT persisted.

CREATE TABLE IF NOT EXISTS public.receipt_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NULL REFERENCES public.gastos(id) ON DELETE SET NULL,
  access_key text NOT NULL,
  issuer_cnpj text NULL,
  issuer_name text NULL,
  issue_date date NULL,
  total numeric(12,2) NULL,
  source text NOT NULL DEFAULT 'qr',
  fiscal_status text NOT NULL DEFAULT 'identified_key',
  verification_mode text NOT NULL DEFAULT 'unavailable',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_imports_access_key_chk CHECK (access_key ~ '^\d{44}$'),
  CONSTRAINT receipt_imports_source_chk CHECK (source IN ('qr','receipt','qr+receipt')),
  CONSTRAINT receipt_imports_total_chk CHECK (total IS NULL OR total >= 0),
  CONSTRAINT receipt_imports_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.household_members(auth_user_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS receipt_imports_access_key_uidx
  ON public.receipt_imports(access_key);

CREATE INDEX IF NOT EXISTS receipt_imports_expense_idx
  ON public.receipt_imports(expense_id);

ALTER TABLE public.receipt_imports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.receipt_imports FROM public, anonymous;
GRANT SELECT, INSERT ON public.receipt_imports TO authenticated;

DROP POLICY IF EXISTS receipt_imports_auth_select ON public.receipt_imports;
CREATE POLICY receipt_imports_auth_select ON public.receipt_imports
FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS receipt_imports_auth_insert ON public.receipt_imports;
CREATE POLICY receipt_imports_auth_insert ON public.receipt_imports
FOR INSERT TO authenticated
WITH CHECK (public.is_household_member() AND created_by = auth.uid());

NOTIFY pgrst, 'reload schema';
