(function () {
  'use strict';

  const PEOPLE = {
    paulo: 'Paulo Henrique',
    fernando: 'Fernando Gustavo'
  };

  function calculate(expenses, settlements, paymentMethod) {
    let pauloPaid = 0;
    let fernandoPaid = 0;

    (expenses || []).forEach(expense => {
      if ((expense.formaPagamento || 'Dinheiro') !== paymentMethod) return;
      const value = Number(expense.valor) || 0;
      if (expense.usuario === PEOPLE.paulo) pauloPaid += value;
      if (expense.usuario === PEOPLE.fernando) fernandoPaid += value;
    });

    const grossPaulo = pauloPaid - ((pauloPaid + fernandoPaid) / 2);
    let transferredToPaulo = 0;
    (settlements || []).forEach(item => {
      if (item.formaPagamento !== paymentMethod) return;
      const value = Number(item.valor) || 0;
      if (item.pagador === PEOPLE.fernando && item.recebedor === PEOPLE.paulo) transferredToPaulo += value;
      if (item.pagador === PEOPLE.paulo && item.recebedor === PEOPLE.fernando) transferredToPaulo -= value;
    });

    const signedRemaining = grossPaulo - transferredToPaulo;
    const isSettled = Math.abs(signedRemaining) < 0.005;
    return {
      paymentMethod,
      gross: Math.abs(grossPaulo),
      settled: Math.max(0, Math.abs(grossPaulo) - Math.abs(signedRemaining)),
      remaining: isSettled ? 0 : Math.abs(signedRemaining),
      debtor: isSettled ? null : signedRemaining > 0 ? PEOPLE.fernando : PEOPLE.paulo,
      creditor: isSettled ? null : signedRemaining > 0 ? PEOPLE.paulo : PEOPLE.fernando,
      isSettled
    };
  }

  window.GastosSettlementCore = { PEOPLE, calculate };
})();
