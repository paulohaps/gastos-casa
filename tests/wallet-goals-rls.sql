-- Fixtures revertidas dentro do sub-bloco; executar apenas na prévia isolada.
DO $$
DECLARE a uuid; b uuid; wallet uuid := gen_random_uuid(); count_rows integer;
BEGIN
  SELECT auth_user_id INTO a FROM household_members WHERE ativo ORDER BY auth_user_id LIMIT 1;
  SELECT auth_user_id INTO b FROM household_members WHERE ativo AND auth_user_id <> a ORDER BY auth_user_id LIMIT 1;
  IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Dois membros necessários para teste'; END IF;
  BEGIN
    INSERT INTO personal_wallets(id,owner_id,nome,limite_mensal,goal_nome,goal_valor,goal_reserva,goal_prazo,goal_mes)
      VALUES(wallet,a,'Fixture meta privada',500,'Viagem',1000,100,'2026-12-01','2026-10');
    PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO count_rows FROM personal_wallets WHERE id=wallet AND goal_nome='Viagem';
    IF count_rows <> 1 THEN RAISE EXCEPTION 'Dono sem acesso à meta'; END IF;
    UPDATE personal_wallets SET goal_reserva=200 WHERE id=wallet;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dono não edita meta'; END IF;
    PERFORM set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
    SELECT count(*) INTO count_rows FROM personal_wallets WHERE id=wallet;
    IF count_rows <> 0 THEN RAISE EXCEPTION 'Meta exposta'; END IF;
    UPDATE personal_wallets SET goal_reserva=999 WHERE id=wallet;
    IF FOUND THEN RAISE EXCEPTION 'Outro membro editou meta'; END IF;
    PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
    BEGIN
      UPDATE personal_wallets SET goal_reserva=1001 WHERE id=wallet;
      RAISE EXCEPTION 'Reserva maior que meta aceita';
    EXCEPTION WHEN check_violation THEN NULL; END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='rollback_fixture';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
END $$;
