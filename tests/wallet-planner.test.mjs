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

test('simulação preserva reserva e mostra excesso sem gravar lançamentos', () => {
  const plan = analyze(input);
  const scenario = globalThis.GastosWalletPlanner.simulate(plan, 150, 100);
  assert.equal(scenario.afterPurchase, 350);
  assert.equal(scenario.afterReserve, 250);
  assert.equal(scenario.daily, 11.36);
  assert.equal(scenario.reserveCovered, true);
  const excess = globalThis.GastosWalletPlanner.simulate(plan, 600);
  assert.equal(excess.exceeds, true);
  assert.equal(excess.afterPurchase, -100);
  assert.equal(excess.daily, 0);
  assert.equal(plan.spent, 500);
});
test('simulação não inventa orçamento e rejeita entradas inválidas', () => {
  assert.equal(globalThis.GastosWalletPlanner.simulate(analyze({ ...input, limit: 0 }), 100), null);
  for (const amount of [NaN, Infinity, 0, -10]) assert.throws(() => globalThis.GastosWalletPlanner.simulate(analyze(input), amount));
  assert.throws(() => globalThis.GastosWalletPlanner.simulate(analyze(input), 100, -1));
  assert.equal(globalThis.GastosWalletPlanner.simulate(analyze(input), 450, 100).reserveCovered, false);
});
test('projeção exige mês atual, sete dias e pelo menos três gastos', () => {
  const plan = { month: '2026-10', spent: 300, count: 3 };
  assert.deepEqual(globalThis.GastosWalletPlanner.forecast(plan, new Date(2026, 9, 10)), { projected: 930, elapsed: 10, days: 31 });
  assert.equal(globalThis.GastosWalletPlanner.forecast(plan, new Date(2026, 9, 6)), null);
  assert.equal(globalThis.GastosWalletPlanner.forecast({ ...plan, count: 2 }, new Date(2026, 9, 10)), null);
  assert.equal(globalThis.GastosWalletPlanner.forecast(plan, new Date(2026, 10, 10)), null);
  assert.equal(globalThis.GastosWalletPlanner.forecast(null), null);
});
