export const HOUSEHOLD = Object.freeze({
  paulo: 'Paulo Henrique',
  fernando: 'Fernando Gustavo'
});

export function calculateSettlement(expenses = [], settlements = [], paymentMethod = 'Dinheiro') {
  let pauloPaid = 0;
  let fernandoPaid = 0;

  for (const expense of expenses) {
    const method = expense.forma_pagamento || expense.formaPagamento || 'Dinheiro';
    if (method !== paymentMethod) continue;
    const value = Number(expense.valor) || 0;
    if (expense.usuario === HOUSEHOLD.paulo) pauloPaid += value;
    if (expense.usuario === HOUSEHOLD.fernando) fernandoPaid += value;
  }

  const grossPaulo = pauloPaid - ((pauloPaid + fernandoPaid) / 2);
  let transferredToPaulo = 0;

  for (const settlement of settlements) {
    const method = settlement.forma_pagamento || settlement.formaPagamento;
    if (method !== paymentMethod) continue;
    const value = Number(settlement.valor) || 0;
    if (settlement.pagador === HOUSEHOLD.fernando && settlement.recebedor === HOUSEHOLD.paulo) {
      transferredToPaulo += value;
    } else if (settlement.pagador === HOUSEHOLD.paulo && settlement.recebedor === HOUSEHOLD.fernando) {
      transferredToPaulo -= value;
    }
  }

  const remainingPaulo = grossPaulo - transferredToPaulo;
  const settled = Math.max(0, Math.abs(grossPaulo) - Math.abs(remainingPaulo));
  const isSettled = Math.abs(remainingPaulo) < 0.005;
  const debtor = isSettled ? null : remainingPaulo > 0 ? HOUSEHOLD.fernando : HOUSEHOLD.paulo;
  const creditor = isSettled ? null : remainingPaulo > 0 ? HOUSEHOLD.paulo : HOUSEHOLD.fernando;

  return {
    paymentMethod,
    gross: Math.abs(grossPaulo),
    settled,
    remaining: isSettled ? 0 : Math.abs(remainingPaulo),
    debtor,
    creditor,
    isSettled
  };
}
