-- Gastos 2.0 - orçamento e gastos recorrentes
-- Aplicado inicialmente em 2026-09-19 no Neon.

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL CHECK (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  categoria text NOT NULL,
  valor_limite numeric(12,2) NOT NULL CHECK (valor_limite >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes, categoria)
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;

CREATE POLICY orcamentos_auth_select
ON public.orcamentos FOR SELECT TO authenticated
USING (true);

CREATE POLICY orcamentos_auth_insert
ON public.orcamentos FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY orcamentos_auth_update
ON public.orcamentos FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY orcamentos_auth_delete
ON public.orcamentos FOR DELETE TO authenticated
USING (true);

CREATE TABLE IF NOT EXISTS public.gastos_recorrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  categoria text NOT NULL DEFAULT 'Outros',
  forma_pagamento text NOT NULL DEFAULT 'Dinheiro',
  dia_vencimento smallint NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gastos_recorrentes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos_recorrentes TO authenticated;

CREATE POLICY recorrentes_auth_select
ON public.gastos_recorrentes FOR SELECT TO authenticated
USING (true);

CREATE POLICY recorrentes_auth_insert
ON public.gastos_recorrentes FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY recorrentes_auth_update
ON public.gastos_recorrentes FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY recorrentes_auth_delete
ON public.gastos_recorrentes FOR DELETE TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS gastos_recorrentes_ativo_idx
ON public.gastos_recorrentes (ativo, dia_vencimento);
