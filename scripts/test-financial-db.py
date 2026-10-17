"""Real PostgreSQL concurrency/RLS regression; creates only its own disposable container."""
import concurrent.futures
import os
import json
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
    sql((ROOT / 'tests/fixtures/financial-schema.sql').read_text())
    sql("""
    INSERT INTO public.household_members(auth_user_id,nome,ativo) VALUES
      ('11111111-1111-4111-8111-111111111111','Paulo Henrique',true),
      ('22222222-2222-4222-8222-222222222222','Fernando Gustavo',true);
    INSERT INTO public.gastos(data,usuario,valor,forma_pagamento,descricao) VALUES
      ('2026-09-01','Paulo Henrique',100,'Dinheiro','Fixture sintética'),
      ('2026-09-01','Fernando Gustavo',300,'Dinheiro','Fixture sintética');
    """)
    sql(f"INSERT INTO public.acertos(competencia,data_pagamento,pagador,recebedor,forma_pagamento,valor,created_by) VALUES('2026-09-01','2026-09-02','Paulo Henrique','Fernando Gustavo','Dinheiro',35,'{PH}');")
    historical = sql('SELECT md5(string_agg(row_to_json(a)::text,\'\' ORDER BY id)) FROM public.acertos a;').stdout.strip()
    sql('SET ROLE gastos_casa_owner;\n' + (ROOT / 'db/migrations/20261015_atomic_settlements.sql').read_text())
    assert sql('SELECT md5(string_agg(row_to_json(a)::text,\'\' ORDER BY id)) FROM public.acertos a;').stdout.strip() == historical
    print('PASS: migration preserves historical rows')
    assert sql("SELECT r.rolsuper OR r.rolbypassrls FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.proname='record_settlement';").stdout.strip() == 'f'
    assert sql(session(PH, "SELECT public.settlement_capabilities()->>'policy';")).stdout.strip() == 'cents-v1'
    assert sql("SET ROLE anonymous; SELECT public.settlement_capabilities();",check=False).returncode != 0
    print('PASS: capability authorization and RPC owner without superuser/BYPASSRLS')
    denied = sql(session(PH, "INSERT INTO public.gastos(data,usuario,valor,forma_pagamento,descricao) VALUES('2026-09-01','Fernando Gustavo',1,'Dinheiro','Fixture sintética');"), check=False)
    assert denied.returncode != 0 and 'row-level security' in denied.stderr
    identity = sql("SET ROLE gastos_casa_owner; UPDATE public.gastos SET usuario='Fernando Gustavo' WHERE usuario='Paulo Henrique';",check=False)
    assert identity.returncode != 0 and 'responsável pelo gasto' in identity.stderr
    identity = sql("SET ROLE gastos_casa_owner; UPDATE public.acertos SET pagador='Fernando Gustavo' WHERE pagador='Paulo Henrique';",check=False)
    assert identity.returncode != 0 and 'identidade do acerto' in identity.stderr
    print('PASS: production expense RLS and identity triggers remain enforced')

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

    sql("INSERT INTO public.gastos(data,usuario,valor,forma_pagamento,descricao) VALUES('2026-10-01','Paulo Henrique',0.03,'Dinheiro','Fixture sintética');")
    sql(payment('odd-cent-test',0.01,FG,'Paulo Henrique','2026-10-01'))
    assert sql(payment('odd-cent-test-2',0.01,FG,'Paulo Henrique','2026-10-01'),check=False).returncode != 0
    print('PASS: odd-cent allocation settles exactly without reversing debt')

    # Expense transaction holds period lock; the concurrent RPC must re-read the committed balance.
    hold = subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','exec','-i',NAME,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    hold.stdin.write("BEGIN; INSERT INTO public.gastos(data,usuario,valor,forma_pagamento,descricao) VALUES('2026-09-01','Paulo Henrique',130,'Dinheiro','Fixture sintética');\n\\echo LOCKED\nSELECT pg_sleep(1); COMMIT;\n")
    hold.stdin.close()
    assert hold.stdout.readline().strip() == 'LOCKED'
    rejected = sql(payment('expense-concurrent',65),check=False)
    hold.wait(timeout=10)
    assert hold.returncode == 0
    assert rejected.returncode != 0
    print('PASS: expense mutation and payment share transaction lock')
    original = sql("SELECT md5(string_agg(row_to_json(g)::text,'' ORDER BY id)) FROM public.gastos g;").stdout.strip()
    sql((ROOT/'db/migrations/20261017_00_expense_rpc_owner.sql').read_text())
    sql('SET ROLE gc_expense_rpc_owner;\n'+(ROOT/'db/migrations/20261017_expense_requests.sql').read_text())
    assert sql("SELECT md5(string_agg(row_to_json(g)::text,'' ORDER BY id)) FROM public.gastos g;").stdout.strip()==original
    assert sql("SELECT r.rolsuper OR r.rolbypassrls FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.proname='record_expense';").stdout.strip()=='f'
    print('PASS: expense migration preserves history and uses dedicated owner without BYPASSRLS')
    def expense(key,value='0.30',owner=PH):
        return session(owner,f"SELECT public.record_expense('2099-11-01',{value},'Synthetic operation','Outros','Dinheiro','{key}');")
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        responses=list(pool.map(lambda _:sql(expense('expense-same-key')),range(2)))
    results=[json.loads(r.stdout.strip()) for r in responses]
    assert results[0]['expense']['id']==results[1]['expense']['id']
    assert sorted(r['replayed'] for r in results)==[False,True]
    assert sql(expense('expense-same-key','0.31'),check=False).returncode!=0
    assert json.loads(sql(expense('expense-new-key')).stdout.strip())['expense']['id']!=results[0]['expense']['id']
    print('PASS: concurrent expense creation, replay, payload conflict and independent equal expense')
    assert sql(session(FG,'SELECT count(*) FROM public.expense_requests;')).stdout.strip()=='0'
    assert sql(session(PH,"DELETE FROM public.expense_requests;"),check=False).returncode!=0
    assert sql(expense('outsider-key',owner='33333333-3333-4333-8333-333333333333'),check=False).returncode!=0
    for value in ['0.005','0','-1',"'NaN'::numeric","'Infinity'::numeric"]:
        assert sql(expense('invalid-money-key',value),check=False).returncode!=0
    print('PASS: expense ledger isolation, active membership and exact monetary validation')
    sql('BEGIN; '+expense('rollback-operation')+' ROLLBACK;')
    assert sql("SELECT count(*) FROM public.expense_requests WHERE request_key='rollback-operation';").stdout.strip()=='0'
    saved=results[0]['expense'];sql(session(PH,f"UPDATE public.gastos SET descricao='Explicit edit' WHERE id='{saved['id']}';"))
    assert json.loads(sql(expense('expense-same-key')).stdout.strip())['expense']==saved
    sql(session(PH,f"DELETE FROM public.gastos WHERE id='{saved['id']}';"))
    assert json.loads(sql(expense('expense-same-key')).stdout.strip())['expense']==saved
    assert sql(f"SELECT count(*) FROM public.gastos WHERE id='{saved['id']}';").stdout.strip()=='0'
    print('PASS: expense atomic rollback and replay after edit/deletion without recreation')

finally:
    command('docker','rm','--force',NAME)
