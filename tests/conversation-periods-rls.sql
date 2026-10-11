-- Run only on the isolated preview branch. Synthetic messages are rolled back.
DO $$
DECLARE
  owner_a uuid;
  owner_b uuid;
  conversation_id uuid;
  visible_count integer;
BEGIN
  SELECT auth_user_id INTO owner_a FROM public.household_members WHERE ativo ORDER BY auth_user_id LIMIT 1;
  SELECT auth_user_id INTO owner_b FROM public.household_members WHERE ativo AND auth_user_id <> owner_a ORDER BY auth_user_id LIMIT 1;
  IF owner_a IS NULL OR owner_b IS NULL THEN RAISE EXCEPTION 'Two active members required'; END IF;
  BEGIN
    INSERT INTO public.assistant_conversations (owner_id, context_key, messages)
      VALUES (owner_a, 'house:2099-10..2099-12', '[{"role":"user","content":"fixture"},{"role":"assistant","content":"fixture answer"}]')
      RETURNING id INTO conversation_id;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO visible_count FROM public.assistant_conversations WHERE id = conversation_id;
    IF visible_count <> 1 THEN RAISE EXCEPTION 'Owner cannot read history'; END IF;
    UPDATE public.assistant_conversations SET revision = revision + 1 WHERE id = conversation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owner cannot update history'; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO visible_count FROM public.assistant_conversations WHERE id = conversation_id;
    IF visible_count <> 0 THEN RAISE EXCEPTION 'History exposed to another member'; END IF;
    UPDATE public.assistant_conversations SET revision = 8 WHERE id = conversation_id;
    IF FOUND THEN RAISE EXCEPTION 'Another member changed history'; END IF;
    DELETE FROM public.assistant_conversations WHERE id = conversation_id;
    IF FOUND THEN RAISE EXCEPTION 'Another member deleted history'; END IF;
    BEGIN
      INSERT INTO public.assistant_conversations (owner_id, context_key) VALUES (owner_a, 'house:2099-09..2099-11');
      RAISE EXCEPTION 'Another member impersonated owner';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', '99999999-9999-4999-8999-999999999999', 'role', 'authenticated')::text, true);
    SELECT count(*) INTO visible_count FROM public.assistant_conversations WHERE id = conversation_id;
    IF visible_count <> 0 THEN RAISE EXCEPTION 'Non-member can read history'; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
    DELETE FROM public.assistant_conversations WHERE id = conversation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owner cannot delete history'; END IF;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'Rollback synthetic fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END $$;
