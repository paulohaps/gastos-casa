-- Gestão parametrizável de usuários da casa
-- Permite que um membro já autorizado liste e adicione novos membros pelo app.

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.household_members hm
SET email = u.email
FROM neon_auth."user" u
WHERE u.id = hm.auth_user_id
  AND hm.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS household_members_email_uidx
ON public.household_members (lower(email))
WHERE email IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.household_members TO authenticated;

DROP POLICY IF EXISTS household_members_auth_select ON public.household_members;
CREATE POLICY household_members_auth_select ON public.household_members
FOR SELECT TO authenticated
USING (public.is_household_member());

DROP POLICY IF EXISTS household_members_auth_insert ON public.household_members;
CREATE POLICY household_members_auth_insert ON public.household_members
FOR INSERT TO authenticated
WITH CHECK (public.is_household_member());

DROP POLICY IF EXISTS household_members_auth_update ON public.household_members;
CREATE POLICY household_members_auth_update ON public.household_members
FOR UPDATE TO authenticated
USING (public.is_household_member())
WITH CHECK (public.is_household_member());

NOTIFY pgrst, 'reload schema';
