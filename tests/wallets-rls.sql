-- Executar SOMENTE na branch de desenvolvimento após a migração.
-- As fixtures ficam nessa branch, nunca na produção.
DO $$
DECLARE
  owner_a uuid;
  owner_b uuid;
  test_wallet uuid := gen_random_uuid();
  test_expense uuid := gen_random_uuid();
  visible_count integer;
BEGIN
  SELECT auth_user_id INTO owner_a FROM public.household_members WHERE ativo ORDER BY auth_user_id LIMIT 1;
  SELECT auth_user_id INTO owner_b FROM public.household_members WHERE ativo AND auth_user_id <> owner_a ORDER BY auth_user_id LIMIT 1;
  IF owner_a IS NULL OR owner_b IS NULL THEN RAISE EXCEPTION 'São necessários dois membros de teste.'; END IF;
  INSERT INTO public.personal_wallets(id, owner_id, nome, limite_mensal) VALUES (test_wallet, owner_a, 'Teste de isolamento', 500);
  INSERT INTO public.personal_expenses(id, owner_id, wallet_id, data, valor, descricao, categoria)
    VALUES (test_expense, owner_a, test_wallet, '2026-10-11', 25, 'Fixture privada', 'Outros');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO visible_count FROM public.personal_expenses WHERE id = test_expense;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Dono não consegue ler seu gasto.'; END IF;
  UPDATE public.personal_expenses SET valor = 30 WHERE id = test_expense;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dono não consegue editar seu gasto.'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO visible_count FROM public.personal_wallets WHERE id = test_wallet;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Carteira exposta a outro membro.'; END IF;
  SELECT count(*) INTO visible_count FROM public.personal_expenses WHERE id = test_expense;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Gasto exposto a outro membro.'; END IF;
  UPDATE public.personal_expenses SET valor = 999 WHERE id = test_expense;
  IF FOUND THEN RAISE EXCEPTION 'Outro membro alterou o gasto.'; END IF;
  BEGIN
    INSERT INTO public.personal_expenses(owner_id, wallet_id, data, valor, descricao, categoria)
      VALUES (owner_a, test_wallet, '2026-10-11', 10, 'Tentativa indevida', 'Outros');
    RAISE EXCEPTION 'Outro membro conseguiu se passar pelo dono.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Mesmo usando seu owner_id, a FK composta impede gravar em carteira alheia.
  BEGIN
    INSERT INTO public.personal_expenses(owner_id, wallet_id, data, valor, descricao, categoria)
      VALUES (owner_b, test_wallet, '2026-10-11', 10, 'Tentativa de vínculo indevido', 'Outros');
    RAISE EXCEPTION 'Carteira alheia aceitou um gasto.';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  SELECT count(*) INTO visible_count FROM public.personal_wallets;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Não membro consegue ler carteiras.'; END IF;
  EXECUTE 'RESET ROLE';
END
$$;
