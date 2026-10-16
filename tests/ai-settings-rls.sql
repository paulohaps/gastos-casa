-- Executar na branch de preview. Todo efeito desta verificação é revertido.
DO $$
DECLARE
  owner_a uuid;
  owner_b uuid;
  visible_count integer;
BEGIN
  SELECT auth_user_id INTO owner_a FROM public.household_members WHERE ativo ORDER BY auth_user_id LIMIT 1;
  SELECT auth_user_id INTO owner_b FROM public.household_members WHERE ativo AND auth_user_id <> owner_a ORDER BY auth_user_id LIMIT 1;
  IF owner_a IS NULL OR owner_b IS NULL THEN RAISE EXCEPTION 'São necessários dois membros.'; END IF;
  BEGIN
    INSERT INTO public.private_ai_settings(owner_id, provider, model, key_ciphertext)
      VALUES (owner_a, 'deepseek', 'deepseek-flash', repeat('x', 60))
      ON CONFLICT (owner_id) DO UPDATE SET provider = 'deepseek', model = 'deepseek-flash', key_ciphertext = repeat('x', 60);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO visible_count FROM public.private_ai_settings WHERE owner_id = owner_a;
    IF visible_count <> 1 THEN RAISE EXCEPTION 'O dono não pode ler a configuração.'; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO visible_count FROM public.private_ai_settings WHERE owner_id = owner_a;
    IF visible_count <> 0 THEN RAISE EXCEPTION 'Configuração exposta a outro membro.'; END IF;
    UPDATE public.private_ai_settings SET model = 'deepseek-v4-pro' WHERE owner_id = owner_a;
    IF FOUND THEN RAISE EXCEPTION 'Outro membro alterou a configuração.'; END IF;
    BEGIN
      INSERT INTO public.private_ai_settings(owner_id, provider, model, key_ciphertext) VALUES (owner_a, 'gemini', 'gemini-3.8-flash', repeat('y', 60));
      RAISE EXCEPTION 'Outro membro conseguiu se passar pelo dono.';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'Reverter somente as fixtures do teste';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END
$$;
