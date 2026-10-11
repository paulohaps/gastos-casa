-- Carteiras pessoais: aplicar primeiro em uma branch de desenvolvimento.
BEGIN;
CREATE TABLE public.personal_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 2 AND 80),
  limite_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK (limite_mensal >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
CREATE TABLE public.personal_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  wallet_id uuid NOT NULL,
  data date NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  descricao text NOT NULL CHECK (length(trim(descricao)) BETWEEN 1 AND 500),
  categoria text NOT NULL CHECK (categoria IN ('Mercado','Contas','Aluguel','Ifood','Outros')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (wallet_id, owner_id) REFERENCES public.personal_wallets(id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX personal_expenses_wallet_date ON public.personal_expenses(owner_id, wallet_id, data DESC);
ALTER TABLE public.personal_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_wallets, public.personal_expenses FROM public, anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_wallets, public.personal_expenses TO authenticated;
CREATE POLICY personal_wallets_owner ON public.personal_wallets FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.is_household_member())
  WITH CHECK (owner_id = auth.uid() AND public.is_household_member());
CREATE POLICY personal_expenses_owner ON public.personal_expenses FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.is_household_member())
  WITH CHECK (owner_id = auth.uid() AND public.is_household_member());
NOTIFY pgrst, 'reload schema';
COMMIT;
