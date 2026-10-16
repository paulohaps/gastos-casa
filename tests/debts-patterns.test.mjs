import test from 'node:test';
import assert from 'node:assert/strict';
import { settlementSummary } from '../js/core/settlement-summary.mjs';
import { spendingPatterns } from '../js/core/spending-patterns.mjs';
import { createAssistantService } from '../backend/services/assistant.mjs';
const ph = 'Paulo Henrique', fg = 'Fernando Gustavo';
const owner = '11111111-1111-4111-8111-111111111111';
const expenses = [
  { id: 'a', data: '2026-09-07', usuario: ph, valor: '120', categoria: 'Mercado', forma_pagamento: 'Dinheiro' },
  { id: 'b', data: '2026-09-14', usuario: fg, valor: '180.50', categoria: 'Contas', forma_pagamento: 'Dinheiro' },
  { id: 'c', data: '2026-09-21', usuario: ph, valor: '65.90', categoria: 'Mercado', forma_pagamento: 'Vale' },
];
const payments = [{ id: 's', competencia: '2026-09-01', pagador: ph, recebedor: fg, valor: '10', forma_pagamento: 'Dinheiro' }];
const options = { owner: ph, months: ['2026-09'] };
test('saldo pendente separa dívidas opostas por método, desconta acertos e distingue responsabilidade', () => {
  const result = settlementSummary(expenses, payments, options);
  assert.equal(result.payableCents, 2025);
  assert.equal(result.receivableCents, 3295);
  assert.equal(result.responsibilityCents, 18320);
  assert.equal(result.otherResponsibilityCents, 18320);
  assert.equal(result.otherPerson, fg);
  const reverse = settlementSummary(expenses, payments, { ...options, owner: fg });
  assert.equal(reverse.payableCents, 3295);
  assert.equal(reverse.receivableCents, 2025);
});
test('divisão por mês preserva resíduos e não compensa dívidas históricas', () => {
  const result = settlementSummary([
    { data: '2026-08-01', usuario: fg, valor: '0.03' },
    { data: '2026-09-01', usuario: ph, valor: '0.03' },
  ], [], { ...options, months: ['2026-08', '2026-09'] });
  assert.equal(result.payableCents, 2); assert.equal(result.receivableCents, 1);
  assert.equal(result.responsibilityCents, 4);
});
test('dados incompletos, privados, período errado ou método sem regra não geram saldo', () => {
  for (const [rows, transfers, opts] of [
    [expenses, null, options], [expenses, payments, { ...options, owner: 'Terceiro' }],
    [expenses, payments, { ...options, months: ['2026-08'] }],
    [[{ ...expenses[0], forma_pagamento: 'Pix' }], [], options],
    [[{ ...expenses[0], valor: '0.005' }], [], options],
    [expenses, [{ ...payments[0], competencia: '2026-08-01' }], options],
  ]) assert.throws(() => settlementSummary(rows, transfers, opts));
});
test('saldo zero só aparece quando a base completa está realmente quitada', () => {
  const result = settlementSummary([], [], options);
  assert.equal(result.payableCents, 0); assert.equal(result.receivableCents, 0);
  assert.ok(result.balances.every(row => row.direction === 'settled'));
});
test('dias da semana usam calendário local sem deslocamento de timezone e médias por ocorrência', () => {
  const result = spendingPatterns(expenses, { month: '2026-09' }, '2026-09-30');
  const monday = result.weekdays[1];
  assert.equal(monday.day, 'segunda-feira'); assert.equal(monday.count, 3);
  assert.equal(monday.calendarDays, 4); assert.equal(monday.activeDays, 3);
  assert.equal(monday.totalCents, 36640); assert.equal(monday.averagePerCalendarDayCents, 9160);
  assert.equal(result.monthDays[20].totalCents, 6590);
  assert.equal(result.evidence, 'insufficient');
});
test('mês em andamento ignora dias futuros no padrão sem inventar recorrência', () => {
  const result = spendingPatterns(expenses, { month: '2026-09' }, '2026-09-15');
  assert.equal(result.weekdays[1].calendarDays, 2);
  assert.equal(result.distinctSpendingDays, 2);
  assert.equal(result.weekdays[1].totalCents, 30050);
  assert.equal(result.monthDays[20].calendarDays, 0);
  assert.equal(result.monthDays[20].averagePerCalendarDayCents, null);
});
test('vários meses normalizam dias 29–31; datas impossíveis e frações de centavo são recusadas', () => {
  const result = spendingPatterns([], { startMonth: '2026-02', month: '2026-03' }, '2026-04-01');
  assert.equal(result.monthDays[30].calendarDays, 1);
  assert.equal(result.monthDays[27].calendarDays, 2);
  assert.equal(result.evidence, 'insufficient');
  assert.throws(() => spendingPatterns([{ data: '2026-02-30', valor: 1 }], { month: '2026-02' }, '2026-03-01'));
  assert.throws(() => spendingPatterns([{ data: '2026-02-01', valor: 0.005 }], { month: '2026-02' }, '2026-03-01'));
});
async function assistant({ scope = 'house', fail = '', name = ph } = {}) {
  const calls = []; let instruction;
  const service = createAssistantService({
    now: () => Date.parse('2026-10-02T12:00:00Z'),
    resolveConfig: async () => ({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'test' }),
    dataApi: async (path, opts, jwt) => {
      calls.push({ path, opts, jwt });
      if (fail && path.startsWith(fail)) return Response.json({}, { status: 503 });
      if (path.startsWith('/household_members')) return Response.json([{ auth_user_id: owner, nome: name }]);
      if (path.startsWith('/rpc/')) return Response.json({ atomic: true, policy: 'cents-v1' });
      if (path.startsWith('/personal_wallets')) return Response.json([{ id: owner, nome: 'Pessoal', limite_mensal: 500 }]);
      if (/offset=(?!0(?:&|$))/.test(path)) return Response.json([]);
      if (path.startsWith('/acertos')) return Response.json(payments, { headers: { 'content-range': '0-0/1' } });
      return Response.json(path.includes('gte.2026-09') ? expenses : []);
    },
    generate: async (_, text) => { instruction = text; },
  });
  const context = { scope, month: '2026-09', ...(scope === 'wallet' ? { walletId: owner } : {}) };
  const prepared = await service.prepare(owner, 'authorized-jwt', { context, owner: 'attacker', messages: [{ role: 'user', content: 'Quanto devo a Fernando e em que dias gasto mais?' }] });
  await prepared.stream({}); prepared.release();
  const snapshot = JSON.parse(instruction.split('Dados autorizados (campos Cents em centavos; demais valores monetários em reais): ')[1]);
  return { calls, instruction, snapshot };
}
test('IA recebe dívida real do dono autenticado, pagamentos e dias completos, sem somar acerto às despesas', async () => {
  const { snapshot, calls, instruction } = await assistant();
  assert.equal(snapshot.settlements.status, 'available');
  assert.equal(snapshot.settlements.payableCents, 2025);
  assert.equal(snapshot.settlements.receivableCents, 3295);
  assert.equal(snapshot.current.total, 366.4);
  assert.equal(snapshot.myPaidSpendingPatterns.weekdays[1].totalCents, 18590);
  assert.equal(snapshot.spendingPatterns.weekdays[1].totalCents, 36640);
  assert.ok(calls.every(call => call.jwt === 'authorized-jwt'));
  assert.match(instruction, /não compense Dinheiro com Vale/);
});
test('identidade invertida não atribui o débito de PH a Fernando', async () => {
  const { snapshot } = await assistant({ name: fg });
  assert.equal(snapshot.settlements.payableCents, 3295);
  assert.equal(snapshot.settlements.receivableCents, 2025);
});
test('falha de pagamentos ou capacidade não vira quitação, mas mantém análise de gastos', async () => {
  for (const fail of ['/acertos', '/rpc/', '/household_members']) {
    const { snapshot } = await assistant({ fail });
    assert.equal(snapshot.settlements.status, 'unavailable');
    assert.equal(snapshot.settlements.payableCents, undefined);
    assert.equal(snapshot.current.total, 366.4);
  }
});
test('contexto privado não consulta pagamentos, participantes nem gastos da Casa', async () => {
  const { snapshot, calls } = await assistant({ scope: 'wallet' });
  assert.equal(snapshot.settlements.status, 'not_applicable');
  assert.equal(snapshot.myPaidSpendingPatterns, undefined);
  assert.ok(calls.every(({ path }) => !/^\/(gastos|acertos|household_members|rpc)/.test(path)));
});
