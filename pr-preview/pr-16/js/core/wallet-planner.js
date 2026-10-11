(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GastosWalletPlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'wallet-planner-v1';
  const CATEGORIES = ['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'];
  const round = n => Math.round(n * 100) / 100;
  function analyze({ expenses = [], limit = 0, month, today = new Date() } = {}) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(month));
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new Error('Mês inválido.');
    const year = Number(match[1]), mm = Number(match[2]);
    const days = new Date(year, mm, 0).getDate();
    const current = today.getFullYear() === year && today.getMonth() + 1 === mm;
    const elapsed = current ? today.getDate() : days;
    const remainingDays = current ? days - elapsed + 1 : 0;
    const rows = expenses.filter(e => String(e.data).slice(0, 7) === month && Number.isFinite(Number(e.valor)) && Number(e.valor) > 0);
    const spent = round(rows.reduce((n, e) => n + Number(e.valor), 0));
    const budget = Number.isFinite(Number(limit)) && Number(limit) > 0 ? round(Number(limit)) : 0;
    const remaining = budget ? round(Math.max(0, budget - spent)) : null;
    const daily = budget && remainingDays ? round(remaining / remainingDays) : null;
    const signals = [];
    if (budget && spent > budget) signals.push({ type: 'over_budget', amount: round(spent - budget), action: 'Revise gastos adiáveis antes de assumir novas despesas.' });
    if (budget && current && elapsed >= 7 && spent <= budget && spent / budget > elapsed / days + 0.15) signals.push({ type: 'fast_pace', amount: daily, action: 'Use o limite diário restante como referência; contas fixas podem concentrar gastos no início do mês.' });
    const delivery = round(rows.filter(e => e.categoria === 'Ifood').reduce((n, e) => n + Number(e.valor), 0));
    if (delivery >= 100 && rows.filter(e => e.categoria === 'Ifood').length >= 3) signals.push({ type: 'delivery_opportunity', amount: round(delivery * 0.2), action: 'Simule reduzir delivery em 20%. A economia depende de substituir essas compras sem aumentar outros gastos.' });
    const totals = Object.fromEntries(CATEGORIES.map(c => [c, round(rows.filter(e => e.categoria === c).reduce((n, e) => n + Number(e.valor), 0))]));
    return { version: VERSION, month, spent, budget, remaining, daily, remainingDays, count: rows.length, categories: totals, signals: signals.slice(0, 3) };
  }
  // Somente números e categorias permitidas; nomes, descrições e IDs nunca entram no prompt.
  function compact(result) {
    return { v: VERSION, month: result.month, spent: result.spent, budget: result.budget, daily: result.daily, count: result.count,
      categories: CATEGORIES.map(c => [c, result.categories[c]]), signals: result.signals.map(s => [s.type, s.amount]) };
  }
  function forecast(plan, today = new Date()) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(plan?.month));
    if (!match || !Number.isFinite(Number(plan.spent)) || !Number.isFinite(Number(plan.count))) return null;
    const year = Number(match[1]), mm = Number(match[2]);
    if (year !== today.getFullYear() || mm !== today.getMonth() + 1 || today.getDate() < 7 || Number(plan.count) < 3) return null;
    const days = new Date(year, mm, 0).getDate();
    return { projected: round(Number(plan.spent) / today.getDate() * days), elapsed: today.getDate(), days };
  }
  function simulate(plan, amount, reserve = 0) {
    amount = Number(amount); reserve = Number(reserve);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(reserve) || reserve < 0) throw new Error('Informe um valor positivo e uma reserva válida.');
    if (!plan || !Number.isFinite(Number(plan.budget)) || Number(plan.budget) <= 0) return null;
    const afterPurchase = round(Number(plan.budget) - Number(plan.spent) - amount);
    const afterReserve = round(afterPurchase - reserve);
    return { afterPurchase, afterReserve, exceeds: afterPurchase < 0, reserveCovered: afterReserve >= 0,
      daily: Number(plan.remainingDays) > 0 ? round(Math.max(0, afterReserve) / Number(plan.remainingDays)) : null };
  }
  return Object.freeze({ VERSION, analyze, compact, forecast, simulate });
});
