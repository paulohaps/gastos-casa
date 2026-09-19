-- Gastos 2.0 - hardening de segurança e consistência
-- Aplicado em produção em 2026-09-19.
--
-- Objetivos:
-- 1. Restringir o app aos dois membros autorizados da casa.
-- 2. Evitar que um cadastro externo autenticado leia/altere dados financeiros.
-- 3. Resolver o nome do responsável pelo UUID autenticado.
-- 4. Restringir categorias e formas de pagamento aos valores suportados pelo app.

CREATE TABLE IF NOT EXISTS public.household_members (
  auth_user_id uuid PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.household_members FROM public, anonymous, authenticated;

CREATE OR REPLACE FUNCTION public.is_household_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.auth_user_id = auth.uid()
      AND hm.ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT hm.nome
  FROM public.household_members hm
  WHERE hm.auth_user_id = auth.uid()
    AND hm.ativo = true
  LIMIT 1;
$$;

DROP POLICY IF EXISTS gastos_auth_select ON public.gastos;
CREATE POLICY gastos_auth_select ON public.gastos
FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS gastos_auth_insert ON public.gastos;
CREATE POLICY gastos_auth_insert ON public.gastos
FOR INSERT TO authenticated
WITH CHECK (
  public.is_household_member()
  AND public.current_app_user_name() IS NOT NULL
  AND usuario = public.current_app_user_name()
);

DROP POLICY IF EXISTS gastos_auth_update ON public.gastos;
CREATE POLICY gastos_auth_update ON public.gastos
FOR UPDATE TO authenticated
USING (public.is_household_member())
WITH CHECK (public.is_household_member());

DROP POLICY IF EXISTS gastos_auth_delete ON public.gastos;
CREATE POLICY gastos_auth_delete ON public.gastos
FOR DELETE TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS orcamentos_auth_select ON public.orcamentos;
CREATE POLICY orcamentos_auth_select ON public.orcamentos
FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS orcamentos_auth_insert ON public.orcamentos;
CREATE POLICY orcamentos_auth_insert ON public.orcamentos
FOR INSERT TO authenticated
WITH CHECK (public.is_household_member());

DROP POLICY IF EXISTS orcamentos_auth_update ON public.orcamentos;
CREATE POLICY orcamentos_auth_update ON public.orcamentos
FOR UPDATE TO authenticated
USING (public.is_household_member())
WITH CHECK (public.is_household_member());

DROP POLICY IF EXISTS orcamentos_auth_delete ON public.orcamentos;
CREATE POLICY orcamentos_auth_delete ON public.orcamentos
FOR DELETE TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS recorrentes_auth_select ON public.gastos_recorrentes;
CREATE POLICY recorrentes_auth_select ON public.gastos_recorrentes
FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS recorrentes_auth_insert ON public.gastos_recorrentes;
CREATE POLICY recorrentes_auth_insert ON public.gastos_recorrentes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_household_member()
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS recorrentes_auth_update ON public.gastos_recorrentes;
CREATE POLICY recorrentes_auth_update ON public.gastos_recorrentes
FOR UPDATE TO authenticated
USING (public.is_household_member())
WITH CHECK (public.is_household_member());

DROP POLICY IF EXISTS recorrentes_auth_delete ON public.gastos_recorrentes;
CREATE POLICY recorrentes_auth_delete ON public.gastos_recorrentes
FOR DELETE TO authenticated
USING (public.is_household_member());

-- Os UUIDs/nomes dos membros são dados de ambiente.
-- Não são versionados neste arquivo. O seed é feito administrativamente.

ALTER TABLE public.gastos
  DROP CONSTRAINT IF EXISTS gastos_categoria_chk,
  ADD CONSTRAINT gastos_categoria_chk
    CHECK (categoria IN ('Mercado','Contas','Aluguel','Ifood','Outros'));

ALTER TABLE public.gastos
  DROP CONSTRAINT IF EXISTS gastos_forma_pagamento_chk,
  ADD CONSTRAINT gastos_forma_pagamento_chk
    CHECK (forma_pagamento IN ('Dinheiro','Vale'));

ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_categoria_chk,
  ADD CONSTRAINT orcamentos_categoria_chk
    CHECK (categoria IN ('Mercado','Contas','Aluguel','Ifood','Outros'));

ALTER TABLE public.gastos_recorrentes
  DROP CONSTRAINT IF EXISTS recorrentes_categoria_chk,
  ADD CONSTRAINT recorrentes_categoria_chk
    CHECK (categoria IN ('Mercado','Contas','Aluguel','Ifood','Outros'));

ALTER TABLE public.gastos_recorrentes
  DROP CONSTRAINT IF EXISTS recorrentes_forma_pagamento_chk,
  ADD CONSTRAINT recorrentes_forma_pagamento_chk
    CHECK (forma_pagamento IN ('Dinheiro','Vale'));
