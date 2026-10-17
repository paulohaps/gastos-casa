-- Administrative prerequisite when the application owner has BYPASSRLS.
-- Run once in the target branch BEFORE 20261017_expense_requests.sql.
-- Does not grant the new role to authenticated users or alter existing policies.
BEGIN;
CREATE ROLE gc_expense_rpc_owner NOLOGIN NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT gc_expense_rpc_owner TO gastos_casa_owner;
GRANT USAGE, CREATE ON SCHEMA public TO gc_expense_rpc_owner;
GRANT REFERENCES(auth_user_id) ON public.household_members TO gc_expense_rpc_owner;
GRANT SELECT, INSERT ON public.gastos TO gc_expense_rpc_owner;
GRANT EXECUTE ON FUNCTION public.is_household_member(),public.current_app_user_name() TO gc_expense_rpc_owner;
CREATE POLICY gastos_expense_rpc_select ON public.gastos FOR SELECT TO gc_expense_rpc_owner USING(public.is_household_member());
CREATE POLICY gastos_expense_rpc_insert ON public.gastos FOR INSERT TO gc_expense_rpc_owner WITH CHECK(public.is_household_member() AND usuario=public.current_app_user_name());
-- Native auth schema is managed by cloud_admin; do not broaden its grants.
-- This wrapper reads only the caller identity, never financial tables.
CREATE FUNCTION public.expense_actor_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS 'SELECT auth.uid()';
REVOKE ALL ON FUNCTION public.expense_actor_id() FROM public,anonymous;
GRANT EXECUTE ON FUNCTION public.expense_actor_id() TO authenticated,gc_expense_rpc_owner;
COMMIT;
-- Execute the next migration with SET ROLE gc_expense_rpc_owner.
