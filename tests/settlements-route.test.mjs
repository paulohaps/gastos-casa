import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettlementsRouter } from '../backend/routes/settlements.mjs';

const expenses = [
  { usuario: 'Paulo Henrique', valor: 100, forma_pagamento: 'Dinheiro' },
  { usuario: 'Fernando Gustavo', valor: 300, forma_pagamento: 'Dinheiro' }
];
const partial = [
  { id: 's1', pagador: 'Paulo Henrique', recebedor: 'Fernando Gustavo', valor: 35, forma_pagamento: 'Dinheiro' }
];

function setup(userName = 'Paulo Henrique') {
  let inserted = null;
  const dataApi = async (path, options = {}) => {
    if (path.startsWith('/gastos?')) return Response.json(expenses);
    if (path.startsWith('/acertos?')) return Response.json(partial);
    if (path === '/acertos' && options.method === 'POST') {
      inserted = JSON.parse(options.body);
      return Response.json([{ id: 'new', ...inserted }]);
    }
    return Response.json([], { status: 404 });
  };
  const json = (_req, status, body) => Response.json(body, { status });
  const router = createSettlementsRouter({
    requireAuth: async () => ({ auth: { jwt: 'jwt', token: 'token', user: { name: userName } } }),
    readJson: req => req.json(),
    json,
    dataApi,
    monthRange: month => month === '09/2026' ? { start: '2026-09-01', end: '2026-10-01' } : null,
    monthToDb: month => month === '09/2026' ? '2026-09' : null
  });
  return { router, getInserted: () => inserted };
}

function request(body) {
  return new Request('https://example.test/settlements', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'add', month: '09/2026', dataPagamento: '2026-09-22',
      recebedor: 'Fernando Gustavo', formaPagamento: 'Dinheiro', observacao: '',
      ...body
    })
  });
}

test('backend rejeita pagamento acima do saldo restante', async () => {
  const { router, getInserted } = setup();
  const response = await router(request({ valor: 70 }), new URL('https://example.test/settlements'));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).details.remaining, 65);
  assert.equal(getInserted(), null);
});

test('backend rejeita registro iniciado pelo credor', async () => {
  const { router } = setup('Fernando Gustavo');
  const response = await router(request({ valor: 10, recebedor: 'Paulo Henrique' }), new URL('https://example.test/settlements'));
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /devedor atual/);
});

test('backend aceita quitação exata e fixa o pagador pela sessão', async () => {
  const { router, getInserted } = setup();
  const response = await router(request({ valor: 65, pagador: 'Fernando Gustavo' }), new URL('https://example.test/settlements'));
  assert.equal(response.status, 200);
  assert.equal(getInserted().pagador, 'Paulo Henrique');
  assert.equal(getInserted().valor, 65);
  assert.equal(getInserted().competencia, '2026-09-01');
});
