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
