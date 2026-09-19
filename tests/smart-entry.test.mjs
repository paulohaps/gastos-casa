import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSmartEntry } from '../backend/smart-entry/parser.mjs';

const todayKey = '2026-09-19';

test('interpreta valor, mercado, hoje e cartão', () => {
  const r = parseSmartEntry('Paguei 87,50 no mercado hoje no cartão', { todayKey });
  assert.equal(r.intent, 'expense');
  assert.equal(r.draft.valor, 87.5);
  assert.equal(r.draft.categoria, 'Mercado');
  assert.equal(r.draft.formaPagamento, 'Dinheiro');
  assert.equal(r.draft.data, '2026-09-19');
  assert.ok(r.confidence.valor >= 0.9);
});

test('interpreta ontem e vale', () => {
  const r = parseSmartEntry('iFood 65 ontem no vale', { todayKey });
  assert.equal(r.draft.valor, 65);
  assert.equal(r.draft.categoria, 'Ifood');
  assert.equal(r.draft.formaPagamento, 'Vale');
  assert.equal(r.draft.data, '2026-09-18');
});

test('usa histórico para categoria quando não há regra direta', () => {
  const history = [
    { descricao: 'Posto Trevo', categoria: 'Contas' },
    { descricao: 'Posto Trevo', categoria: 'Contas' },
    { descricao: 'Posto Trevo', categoria: 'Contas' }
  ];
  const r = parseSmartEntry('Posto Trevo 120', { todayKey, history });
  assert.equal(r.draft.categoria, 'Contas');
  assert.match(r.source.categoria, /history/);
});

test('não transforma consulta em gasto', () => {
  const r = parseSmartEntry('Quanto eu gastei no mercado?', { todayKey });
  assert.equal(r.intent, 'unsupported');
  assert.equal(r.draft, null);
});

test('não inventa valor quando há múltiplos candidatos', () => {
  const r = parseSmartEntry('mercado 150 e farmácia 35', { todayKey });
  assert.equal(r.draft.valor, null);
  assert.equal(r.needsReview, true);
  assert.ok(r.warnings.some(w => w.code === 'MULTIPLE_VALUES'));
});

test('dia do mês não é confundido com valor', () => {
  const r = parseSmartEntry('internet dia 10 129,90', { todayKey });
  assert.equal(r.draft.valor, 129.9);
  assert.equal(r.draft.data, '2026-09-10');
  assert.equal(r.draft.categoria, 'Contas');
});

test('forma de pagamento ausente gera aviso mas mantém fallback', () => {
  const r = parseSmartEntry('aluguel 900', { todayKey });
  assert.equal(r.draft.formaPagamento, 'Dinheiro');
  assert.ok(r.warnings.some(w => w.code === 'PAYMENT_DEFAULTED'));
});
