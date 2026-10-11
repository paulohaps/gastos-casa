import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/wallet-planner.js';
const { analyze, compact } = globalThis.GastosWalletPlanner;
const input = { month: '2026-10', limit: 1000, today: new Date(2026, 9, 10), expenses: [
  { data: '2026-10-01', valor: 500, categoria: 'Mercado', descricao: 'privado' },
  { data: '2026-09-30', valor: 999, categoria: 'Mercado' }
] };
test('limite diário considera somente a carteira e mês selecionados', () => {
  const plan = analyze(input);
  assert.equal(plan.spent, 500); assert.equal(plan.remainingDays, 22); assert.equal(plan.daily, 22.73);
  assert.equal(plan.signals[0].type, 'fast_pace');
});
test('mês fechado e carteira sem limite não inventam saldo diário', () => {
  assert.equal(analyze({ ...input, limit: 0 }).daily, null);
  assert.equal(analyze({ ...input, today: new Date(2026, 10, 1) }).daily, null);
  assert.equal(analyze({ ...input, expenses: [] }).signals.length, 0);
});
test('estouro não gera limite diário negativo; delivery é apenas cenário', () => {
  const expenses = Array.from({ length: 3 }, () => ({ data: '2026-10-01', valor: 100, categoria: 'Ifood' }));
  const plan = analyze({ ...input, limit: 200, expenses });
  assert.equal(plan.daily, 0); assert.equal(plan.signals[0].amount, 100);
  assert.equal(plan.signals[1].amount, 60);
  assert.ok(!JSON.stringify(compact(analyze(input))).includes('privado'));
});
