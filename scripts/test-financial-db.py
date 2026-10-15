"""Real PostgreSQL concurrency/RLS regression; creates only its own disposable container."""
import concurrent.futures
import os
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
NAME = 'gastos-integrity-' + uuid.uuid4().hex[:10]

def command(*args, **kwargs):
    env = os.environ.copy()
    if args and args[0] == 'docker':
        for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
            env.pop(key, None)
        args = (args[0], '--host=unix:///var/run/docker.sock', *args[1:])
    return subprocess.run(args, text=True, capture_output=True, env=env, **kwargs)

def sql(source, check=True):
    result = command('docker', 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', input=source)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

PH = '11111111-1111-4111-8111-111111111111'
FG = '22222222-2222-4222-8222-222222222222'
def session(owner, query):
    return f"SET ROLE authenticated; SET request.jwt.claim.sub='{owner}'; " + query

def payment(key, value=65, owner=PH, receiver='Fernando Gustavo', month='2026-09-01'):
    return session(owner, f"SELECT id FROM public.record_settlement('{month}','2026-09-22','{receiver}','Dinheiro',{value},'','{key}');")

try:
    created = command('docker', 'run', '--detach', '--rm', '--name', NAME, '--label', 'gastos.disposable-test=true', '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17')
    if created.returncode:
        raise RuntimeError(created.stderr)
    # The image initializes through a temporary Unix-only server, then restarts.
    # TCP loopback is available only on the final server; no port is published.
    for attempt in range(120):
        if command('docker', 'exec', NAME, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres').returncode == 0:
            break
        time.sleep(0.25)
    else:
        raise RuntimeError('Disposable Postgres did not become ready.')
    sql("""
    CREATE ROLE anonymous NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.household_members(auth_user_id uuid PRIMARY KEY,nome text NOT NULL,ativo boolean NOT NULL DEFAULT true);
    INSERT INTO public.household_members VALUES
      ('11111111-1111-4111-8111-111111111111','Paulo Henrique',true),
      ('22222222-2222-4222-8222-222222222222','Fernando Gustavo',true);
    CREATE FUNCTION public.is_household_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS(SELECT 1 FROM public.household_members WHERE auth_user_id=auth.uid() AND ativo) $$;
    CREATE FUNCTION public.current_app_user_name() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT nome FROM public.household_members WHERE auth_user_id=auth.uid() AND ativo $$;
    CREATE TABLE public.gastos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),data date NOT NULL,usuario text NOT NULL,valor numeric(12,2) NOT NULL,forma_pagamento text);
    ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.gastos TO authenticated;
    CREATE POLICY gastos_member ON public.gastos TO authenticated USING(public.is_household_member()) WITH CHECK(public.is_household_member());
    INSERT INTO public.gastos(data,usuario,valor,forma_pagamento) VALUES('2026-09-01','Paulo Henrique',100,'Dinheiro'),('2026-09-01','Fernando Gustavo',300,'Dinheiro');
    """)
    sql((ROOT / 'db/migrations/20260922_settlements.sql').read_text())
    sql(f"INSERT INTO public.acertos(competencia,data_pagamento,pagador,recebedor,forma_pagamento,valor,created_by) VALUES('2026-09-01','2026-09-02','Paulo Henrique','Fernando Gustavo','Dinheiro',35,'{PH}');")
    historical = sql('SELECT md5(string_agg(row_to_json(a)::text,\'\' ORDER BY id)) FROM public.acertos a;').stdout.strip()
    sql((ROOT / 'db/migrations/20261015_atomic_settlements.sql').read_text())
    assert sql('SELECT md5(string_agg(row_to_json(a)::text,\'\' ORDER BY id)) FROM public.acertos a;').stdout.strip() == historical
    print('PASS: migration preserves historical rows')

    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        responses = list(pool.map(lambda key: sql(payment(key), check=False), ['simultaneous-one','simultaneous-two']))
    assert sorted(r.returncode == 0 for r in responses) == [False, True], [r.stderr for r in responses]
    assert sql('SELECT sum(valor) FROM public.acertos;').stdout.strip() == '100.00'
    print('PASS: concurrent full payments commit only once')

    sql("DELETE FROM public.acertos WHERE valor=65; DELETE FROM public.settlement_requests;")
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        responses = list(pool.map(lambda _: sql(payment('same-request-key')), range(2)))
    assert responses[0].stdout == responses[1].stdout
    assert sql('SELECT count(*) FROM public.acertos WHERE valor=65;').stdout.strip() == '1'
    assert sql(payment('same-request-key',64), check=False).returncode != 0
    sql("DELETE FROM public.acertos WHERE valor=65;")
    assert sql(payment('same-request-key')).stdout == responses[0].stdout
    assert sql('SELECT count(*) FROM public.acertos WHERE valor=65;').stdout.strip() == '0'
    print('PASS: replay is idempotent, payload conflict rejected, deleted payment not recreated')

    assert sql(session('33333333-3333-4333-8333-333333333333', "SELECT * FROM public.record_settlement('2026-09-01','2026-09-22','Fernando Gustavo','Dinheiro',1,'','outsider-key');"), check=False).returncode != 0
    assert sql(payment('wrong-debtor',10,FG,'Paulo Henrique'), check=False).returncode != 0
    assert sql(session(PH, "INSERT INTO public.acertos(competencia,data_pagamento,pagador,recebedor,forma_pagamento,valor) VALUES('2026-09-01','2026-09-22','Paulo Henrique','Fernando Gustavo','Dinheiro',65);"), check=False).returncode != 0
    assert sql(session(FG, 'SELECT count(*) FROM public.settlement_requests;')).stdout.strip() == '0'
    assert sql(payment('bad-fraction',0.005), check=False).returncode != 0
    assert sql(payment('above-balance',66), check=False).returncode != 0
    print('PASS: RLS, identity, direct insert, fractions and overpayment rejected')

    sql("INSERT INTO public.gastos(data,usuario,valor,forma_pagamento) VALUES('2026-10-01','Paulo Henrique',0.03,'Dinheiro');")
    sql(payment('odd-cent-test',0.01,FG,'Paulo Henrique','2026-10-01'))
    assert sql(payment('odd-cent-test-2',0.01,FG,'Paulo Henrique','2026-10-01'),check=False).returncode != 0
    print('PASS: odd-cent allocation settles exactly without reversing debt')

    # Expense transaction holds period lock; the concurrent RPC must re-read the committed balance.
    hold = subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','exec','-i',NAME,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    hold.stdin.write("BEGIN; INSERT INTO public.gastos(data,usuario,valor,forma_pagamento) VALUES('2026-09-01','Paulo Henrique',130,'Dinheiro');\n\\echo LOCKED\nSELECT pg_sleep(1); COMMIT;\n")
    hold.stdin.close()
    assert hold.stdout.readline().strip() == 'LOCKED'
    rejected = sql(payment('expense-concurrent',65),check=False)
    hold.wait(timeout=10)
    assert hold.returncode == 0
    assert rejected.returncode != 0
    print('PASS: expense mutation and payment share transaction lock')
finally:
    command('docker','rm','--force',NAME)
