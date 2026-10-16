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
  return Object.freeze({ PEOPLE, cents, calculate });
});
