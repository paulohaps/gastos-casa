(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GastosSettlementCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const PEOPLE = Object.freeze({ paulo: 'Paulo Henrique', fernando: 'Fernando Gustavo' });
  function cents(value) {
    const text = String(value);
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Valor monetário inválido.');
    const [whole, fraction = ''] = text.split('.');
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(result)) throw new Error('Valor monetário fora do limite.');
    return result;
  }
  function add(a, b) {
    const result = a + b;
    if (!Number.isSafeInteger(result)) throw new Error('Total monetário fora do limite.');
    return result;
  }
  function calculate(expenses = [], settlements = [], paymentMethod = 'Dinheiro') {
    if (!Array.isArray(expenses) || !Array.isArray(settlements)) throw new Error('Dados de acerto indisponíveis.');
    let pauloPaid = 0, fernandoPaid = 0, transferred = 0;
    for (const row of expenses) {
      if ((row.forma_pagamento || row.formaPagamento || 'Dinheiro') !== paymentMethod) continue;
      const value = cents(row.valor);
      if (row.usuario === PEOPLE.paulo) pauloPaid = add(pauloPaid, value);
      else if (row.usuario === PEOPLE.fernando) fernandoPaid = add(fernandoPaid, value);
      else throw new Error('Participante sem regra de divisão.');
    }
    const total = add(pauloPaid, fernandoPaid);
    const pauloShare = Math.ceil(total / 2);
    const gross = pauloPaid - pauloShare;
    for (const row of settlements) {
      if ((row.forma_pagamento || row.formaPagamento) !== paymentMethod) continue;
      const value = cents(row.valor);
      if (row.pagador === PEOPLE.fernando && row.recebedor === PEOPLE.paulo) transferred = add(transferred, value);
      else if (row.pagador === PEOPLE.paulo && row.recebedor === PEOPLE.fernando) transferred = add(transferred, -value);
      else throw new Error('Participantes do acerto inválidos.');
    }
    const remaining = add(gross, -transferred), isSettled = remaining === 0;
    return {
      paymentMethod, gross: Math.abs(gross) / 100,
      settled: Math.max(0, Math.abs(gross) - Math.abs(remaining)) / 100,
      remaining: Math.abs(remaining) / 100,
      debtor: isSettled ? null : remaining > 0 ? PEOPLE.fernando : PEOPLE.paulo,
      creditor: isSettled ? null : remaining > 0 ? PEOPLE.paulo : PEOPLE.fernando,
      isSettled,
      responsibilityCents: { paulo: pauloShare, fernando: total - pauloShare }
    };
  }
  /** Read-only, user-relative balances. Never offset debts across methods or months. */
  function summarize(expenses, payments, { owner, months }) {
    if (!Object.values(PEOPLE).includes(owner) || !Array.isArray(expenses) || !Array.isArray(payments) ||
        !Array.isArray(months) || !months.length || new Set(months).size !== months.length ||
        months.some(month => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) throw new Error('Dados de acerto indisponíveis.');
    const monthOf = row => {
      const date = String(row.data || '');
      return (date.includes('/') ? date.split('/').reverse().join('-') : date).slice(0, 7);
    };
    const methodOf = row => row.forma_pagamento || row.formaPagamento || 'Dinheiro';
    if (expenses.some(row => !months.includes(monthOf(row)) || !['Dinheiro', 'Vale'].includes(methodOf(row))) ||
        payments.some(row => !months.includes(String(row.competencia || '').slice(0, 7)) || !['Dinheiro', 'Vale'].includes(methodOf(row)))) throw new Error('Período ou método sem regra de acerto.');
    const otherPerson = Object.values(PEOPLE).find(name => name !== owner);
    let payableCents = 0, receivableCents = 0, responsibilityCents = 0, otherResponsibilityCents = 0;
    const balances = months.flatMap(month => ['Dinheiro', 'Vale'].map(method => {
      const balance = calculate(expenses.filter(row => monthOf(row) === month), payments.filter(row => row.competencia.slice(0, 7) === month), method);
      const amountCents = cents(balance.remaining);
      const direction = balance.isSettled ? 'settled' : balance.debtor === owner ? 'payable' : 'receivable';
      if (direction === 'payable') payableCents = add(payableCents, amountCents);
      if (direction === 'receivable') receivableCents = add(receivableCents, amountCents);
      const ownKey = owner === PEOPLE.paulo ? 'paulo' : 'fernando';
      responsibilityCents = add(responsibilityCents, balance.responsibilityCents[ownKey]);
      otherResponsibilityCents = add(otherResponsibilityCents, balance.responsibilityCents[ownKey === 'paulo' ? 'fernando' : 'paulo']);
      return { month, method, direction, amountCents, debtor: balance.debtor, creditor: balance.creditor };
    }));
    return { owner, otherPerson, payableCents, receivableCents, responsibilityCents, otherResponsibilityCents, balances };
  }
  // A complete read and a compatible financial policy are separate guarantees.
  function availability(payments) {
    if (!Array.isArray(payments)) return 'unavailable';
    if (payments.atomic !== true) return 'upgrade';
    if (payments.complete !== true) return 'incomplete';
    return 'ready';
  }
  return Object.freeze({ PEOPLE, cents, calculate, summarize, availability });
});
