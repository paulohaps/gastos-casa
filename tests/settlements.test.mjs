import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSettlement } from '../backend/settlements/calculator.mjs';

const expenses = [
  { usuario: 'Paulo Henrique', valor: 100, forma_pagamento: 'Dinheiro' },
  { usuario: 'Fernando Gustavo', valor: 300, forma_pagamento: 'Dinheiro' },
  { usuario: 'Paulo Henrique', valor: 80, forma_pagamento: 'Vale' }
];

test('calcula devedor e saldo bruto em 50/50 por forma', () => {
  const money = calculateSettlement(expenses, [], 'Dinheiro');
  assert.equal(money.debtor, 'Paulo Henrique');
  assert.equal(money.creditor, 'Fernando Gustavo');
  assert.equal(money.gross, 100);
  assert.equal(money.remaining, 100);

  const voucher = calculateSettlement(expenses, [], 'Vale');
  assert.equal(voucher.debtor, 'Fernando Gustavo');
  assert.equal(voucher.remaining, 40);
});

test('abate pagamento parcial sem misturar Dinheiro e Vale', () => {
  const settlements = [
    { pagador: 'Paulo Henrique', recebedor: 'Fernando Gustavo', valor: 35, forma_pagamento: 'Dinheiro' },
    { pagador: 'Fernando Gustavo', recebedor: 'Paulo Henrique', valor: 10, forma_pagamento: 'Vale' }
  ];
  const money = calculateSettlement(expenses, settlements, 'Dinheiro');
  assert.equal(money.settled, 35);
  assert.equal(money.remaining, 65);
  assert.equal(money.debtor, 'Paulo Henrique');

  const voucher = calculateSettlement(expenses, settlements, 'Vale');
  assert.equal(voucher.settled, 10);
  assert.equal(voucher.remaining, 30);
});

test('marca quitação integral com tolerância de centavos', () => {
  const result = calculateSettlement(expenses, [
    { pagador: 'Paulo Henrique', recebedor: 'Fernando Gustavo', valor: 100, forma_pagamento: 'Dinheiro' }
  ], 'Dinheiro');
  assert.equal(result.isSettled, true);
  assert.equal(result.remaining, 0);
  assert.equal(result.debtor, null);
});
