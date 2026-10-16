-- Shared financial schema captured from metadata only; contains no user rows.
-- Source: frosty-star-45149603 / br-floral-night-acsx867x / gastos_casa.
-- auth.uid() is a local session stub; the native pg_session_jwt implementation
-- and live Data API/JWT propagation require a separate authenticated check.
CREATE ROLE anonymous NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE gastos_casa_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated, gastos_casa_owner;
GRANT USAGE,CREATE ON SCHEMA public TO gastos_casa_owner;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

CREATE TABLE public."gastos" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "data" date NOT NULL,
  "usuario" text NOT NULL,
  "valor" numeric(12,2) NOT NULL,
  "descricao" text NOT NULL,
  "categoria" text NOT NULL DEFAULT 'Outros'::text,
  "forma_pagamento" text NOT NULL DEFAULT 'Dinheiro'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public."gastos" OWNER TO gastos_casa_owner;
ALTER TABLE public."gastos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."gastos" FROM PUBLIC,anonymous,authenticated;

CREATE TABLE public."acertos" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "competencia" date NOT NULL,
  "data_pagamento" date NOT NULL,
  "pagador" text NOT NULL,
  "recebedor" text NOT NULL,
  "forma_pagamento" text NOT NULL,
  "valor" numeric(12,2) NOT NULL,
  "observacao" text,
  "created_by" uuid NOT NULL DEFAULT auth.uid(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public."acertos" OWNER TO gastos_casa_owner;
ALTER TABLE public."acertos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."acertos" FROM PUBLIC,anonymous,authenticated;

CREATE TABLE public."household_members" (
  "auth_user_id" uuid NOT NULL,
  "nome" text NOT NULL,
  "ativo" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "email" text
);
ALTER TABLE public."household_members" OWNER TO gastos_casa_owner;
ALTER TABLE public."household_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."household_members" FROM PUBLIC,anonymous,authenticated;
ALTER TABLE public."gastos" ADD CONSTRAINT "gastos_categoria_chk" CHECK ((categoria = ANY (ARRAY['Mercado'::text, 'Contas'::text, 'Aluguel'::text, 'Ifood'::text, 'Outros'::text])));
ALTER TABLE public."gastos" ADD CONSTRAINT "gastos_forma_pagamento_chk" CHECK ((forma_pagamento = ANY (ARRAY['Dinheiro'::text, 'Vale'::text])));
ALTER TABLE public."gastos" ADD CONSTRAINT "gastos_pkey" PRIMARY KEY (id);
ALTER TABLE public."gastos" ADD CONSTRAINT "gastos_valor_check" CHECK ((valor > (0)::numeric));
CREATE INDEX gastos_data_idx ON public.gastos USING btree (data);
CREATE INDEX gastos_usuario_idx ON public.gastos USING btree (usuario);
CREATE INDEX gastos_data_usuario_idx ON public.gastos USING btree (data, usuario);
ALTER TABLE public."acertos" ADD CONSTRAINT "acertos_competencia_primeiro_dia_chk" CHECK ((EXTRACT(day FROM competencia) = (1)::numeric));
ALTER TABLE public."acertos" ADD CONSTRAINT "acertos_forma_pagamento_chk" CHECK ((forma_pagamento = ANY (ARRAY['Dinheiro'::text, 'Vale'::text])));
ALTER TABLE public."acertos" ADD CONSTRAINT "acertos_observacao_tamanho_chk" CHECK ((char_length(observacao) <= 240));
ALTER TABLE public."acertos" ADD CONSTRAINT "acertos_partes_distintas_chk" CHECK ((pagador <> recebedor));
ALTER TABLE public."acertos" ADD CONSTRAINT "acertos_pkey" PRIMARY KEY (id);
ALTER TABLE public."acertos" ADD CONSTRAINT "acertos_valor_positivo_chk" CHECK ((valor > (0)::numeric));
CREATE INDEX acertos_competencia_idx ON public.acertos USING btree (competencia, forma_pagamento, data_pagamento DESC);
ALTER TABLE public."household_members" ADD CONSTRAINT "household_members_pkey" PRIMARY KEY (auth_user_id);
CREATE UNIQUE INDEX household_members_email_uidx ON public.household_members USING btree (lower(email)) WHERE (email IS NOT NULL);
CREATE OR REPLACE FUNCTION public.is_household_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.auth_user_id = auth.uid()
      AND hm.ativo = true
  )
$function$
;
ALTER FUNCTION public."is_household_member"() OWNER TO gastos_casa_owner;
CREATE OR REPLACE FUNCTION public.current_app_user_name()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT hm.nome
  FROM public.household_members hm
  WHERE hm.auth_user_id = auth.uid()
    AND hm.ativo = true
  LIMIT 1
$function$
;
ALTER FUNCTION public."current_app_user_name"() OWNER TO gastos_casa_owner;
CREATE OR REPLACE FUNCTION public.prevent_gasto_usuario_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.usuario IS DISTINCT FROM OLD.usuario THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O responsável pelo gasto não pode ser alterado.';
  END IF;
  RETURN NEW;
END
$function$
;
ALTER FUNCTION public."prevent_gasto_usuario_change"() OWNER TO gastos_casa_owner;
CREATE TRIGGER gastos_usuario_immutable BEFORE UPDATE OF usuario ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.prevent_gasto_usuario_change();
CREATE POLICY "acertos_auth_delete" ON public."acertos" FOR DELETE TO authenticated USING (is_household_member());
CREATE POLICY "acertos_auth_insert" ON public."acertos" FOR INSERT TO authenticated WITH CHECK ((is_household_member() AND (created_by = auth.uid()) AND (pagador = current_app_user_name()) AND (recebedor <> current_app_user_name())));
CREATE POLICY "acertos_auth_select" ON public."acertos" FOR SELECT TO authenticated USING (is_household_member());
CREATE POLICY "acertos_auth_update" ON public."acertos" FOR UPDATE TO authenticated USING (is_household_member()) WITH CHECK (is_household_member());
CREATE POLICY "gastos_auth_delete" ON public."gastos" FOR DELETE TO authenticated USING (is_household_member());
CREATE POLICY "gastos_auth_insert" ON public."gastos" FOR INSERT TO authenticated WITH CHECK ((is_household_member() AND (current_app_user_name() IS NOT NULL) AND (usuario = current_app_user_name())));
CREATE POLICY "gastos_auth_select" ON public."gastos" FOR SELECT TO authenticated USING (is_household_member());
CREATE POLICY "gastos_auth_update" ON public."gastos" FOR UPDATE TO authenticated USING (is_household_member()) WITH CHECK (is_household_member());
CREATE POLICY "household_members_auth_insert" ON public."household_members" FOR INSERT TO authenticated WITH CHECK (is_household_member());
CREATE POLICY "household_members_auth_select" ON public."household_members" FOR SELECT TO authenticated USING (is_household_member());
CREATE POLICY "household_members_auth_update" ON public."household_members" FOR UPDATE TO authenticated USING (is_household_member()) WITH CHECK (is_household_member());
GRANT DELETE ON public."acertos" TO authenticated;
GRANT INSERT ON public."acertos" TO authenticated;
GRANT SELECT ON public."acertos" TO authenticated;
GRANT UPDATE ON public."acertos" TO authenticated;
GRANT DELETE ON public."gastos" TO authenticated;
GRANT INSERT ON public."gastos" TO authenticated;
GRANT SELECT ON public."gastos" TO authenticated;
GRANT UPDATE ON public."gastos" TO authenticated;
GRANT INSERT ON public."household_members" TO authenticated;
GRANT SELECT ON public."household_members" TO authenticated;
GRANT UPDATE ON public."household_members" TO authenticated;

ALTER TABLE public."acertos" ADD CONSTRAINT "acertos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES household_members(auth_user_id) ON UPDATE RESTRICT ON DELETE RESTRICT;
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
ALTER FUNCTION public.prevent_acerto_identity_change() OWNER TO gastos_casa_owner;
CREATE TRIGGER acertos_identity_immutable BEFORE UPDATE ON public.acertos FOR EACH ROW EXECUTE FUNCTION public.prevent_acerto_identity_change();
