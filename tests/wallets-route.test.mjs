import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalletsRouter } from '../backend/routes/wallets.mjs';
const owner = '11111111-1111-4111-8111-111111111111', walletId = '22222222-2222-4222-8222-222222222222';
function setup({ accessible = true, authenticated = true } = {}) {
  const calls = [];
  const router = createWalletsRouter({
    requireAuth: async () => authenticated ? { auth: { user: { id: owner }, jwt: 'jwt', token: 'token' } } : { error: Response.json({}, { status: 401 }) },
    readJson: req => req.json(), json: (_req, status, body) => Response.json(body, { status }),
    dataApi: async (path, options) => { calls.push({ path, options });
      if (path.startsWith('/personal_wallets?')) return Response.json(accessible ? [{ id: walletId, nome: 'Privada', limite_mensal: 100 }] : []);
      if (options.method === 'POST') return Response.json([{ id: 'new' }]);
      return Response.json([]);
    }, insightsService: { configured: () => false, explain: async () => ({ source: 'heuristics' }) }
  });
  const request = async (path, body) => { const req = new Request('https://test.local' + path, body ? { method: 'POST', body: JSON.stringify(body) } : {}); return router(req, new URL(req.url)); };
  return { request, calls };
}
test('sessão e dono são verificados antes de acessar despesas privadas', async () => {
  const denied = setup({ authenticated: false }); assert.equal((await denied.request('/wallets')).status, 401); assert.equal(denied.calls.length, 0);
  const other = setup({ accessible: false }); assert.equal((await other.request(`/wallets/expenses?walletId=${walletId}&month=2026-10`)).status, 404);
  assert.equal(other.calls.length, 1); assert.ok(other.calls[0].path.includes(`owner_id=eq.${owner}`));
});
test('identidade enviada pelo cliente não substitui dono autenticado e não grava em gastos compartilhados', async () => {
  const { request, calls } = setup();
  assert.equal((await request('/wallets/expenses', { action: 'add', walletId, owner_id: 'attacker', dataGasto: '2026-10-11', valor: 20, descricao: 'Café', categoria: 'Outros' })).status, 200);
  const write = calls.find(c => c.options.method === 'POST'); assert.equal(write.path, '/personal_expenses');
  assert.equal(JSON.parse(write.options.body).owner_id, owner);
});
test('datas inexistentes, valores inválidos e mês malformado são rejeitados', async () => {
  const { request, calls } = setup();
  assert.equal((await request('/wallets/expenses', { action: 'add', walletId, dataGasto: '2026-02-30', valor: 10, descricao: 'X', categoria: 'Outros' })).status, 400);
  assert.equal((await request('/wallets/expenses', { action: 'add', walletId, dataGasto: '2026-10-11', valor: -10, descricao: 'X', categoria: 'Outros' })).status, 400);
  assert.equal((await request(`/wallets/expenses?walletId=${walletId}&month=2026-99`)).status, 400);
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 0);
});

test('meta valida prazo, centavos e reserva antes de gravar', async () => {
  const { request, calls } = setup();
  const goal = { name: 'Viagem', target: 500, reserve: 100, month: '2026-10', deadline: '2026-12-01' };
  for (const invalid of [{ ...goal, reserve: 501 }, { ...goal, target: 0 }, { ...goal, reserve: 0.001 }, { ...goal, deadline: '2026-02-30' }, { ...goal, deadline: '2026-09-30' }, { ...goal, name: 'X' }, undefined]) {
    assert.equal((await request('/wallets/goal', { walletId, goal: invalid })).status, 400);
  }
  assert.equal(calls.filter(c => c.options.method === 'PATCH').length, 0);
  assert.equal((await request('/wallets/goal', { walletId, goal })).status, 200);
  const write = calls.find(c => c.options.method === 'PATCH');
  assert.ok(write.path.includes(`owner_id=eq.${owner}`));
  assert.deepEqual(JSON.parse(write.options.body), { goal_nome: 'Viagem', goal_valor: 500, goal_reserva: 100, goal_prazo: '2026-12-01', goal_mes: '2026-10' });
});
test('meta alheia não pode ser editada e remoção mantém filtro por dono', async () => {
  const other = setup({ accessible: false });
  assert.equal((await other.request('/wallets/goal', { walletId, goal: null })).status, 404);
  assert.equal(other.calls.filter(c => c.options.method === 'PATCH').length, 0);
  const own = setup();
  assert.equal((await own.request('/wallets/goal', { walletId, goal: null })).status, 200);
  const write = own.calls.find(c => c.options.method === 'PATCH');
  assert.ok(write.path.includes(`id=eq.${walletId}&owner_id=eq.${owner}`));
  assert.equal(Object.values(JSON.parse(write.options.body)).every(value => value === null), true);
});

test('explicação do cofre usa a mesma reserva protegida do chat e não envia nome da meta no resumo', async () => {
  let advice;
  const router = createWalletsRouter({
    requireAuth: async () => ({ auth: { user: { id: owner }, jwt: 'jwt', token: 'token' } }),
    readJson: req => req.json(), json: (_req, status, body) => Response.json(body, { status }),
    dataApi: async path => Response.json(path.startsWith('/personal_wallets') ? [{ id: walletId, nome: 'Pessoal', limite_mensal: 100, goal_nome: 'Meta privada não enviar', goal_valor: 500, goal_reserva: 80, goal_prazo: '2026-12-01', goal_mes: '2026-10' }] : []),
    insightsService: { configured: () => true, explain: async (_owner, _wallet, result) => { advice = result; return { source: 'heuristics', text: 'Referência protegida.' }; } },
  });
  const request = new Request('https://test/wallets/insights', { method: 'POST', body: JSON.stringify({ walletId, month: '2026-10' }) });
  assert.equal((await router(request, new URL(request.url))).status, 200);
  assert.equal(advice.protectedBudget.reserve, 80); assert.equal(advice.protectedBudget.available, 20);
  assert.equal(advice.daily, advice.protectedBudget.daily);
  assert.equal(JSON.stringify(globalThis.GastosWalletPlanner.compact(advice)).includes('Meta privada'), false);
});
