import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parser = require('../js/core/receipt-parser.js');

test('NFC-e offline extrai chave e valor do payload p', () => {
  const key = '35260912345678000123650010000012341000012345';
  const url = 'https://nfce.fazenda.sp.gov.br/qrcode?p=' +
    key + '|2|1|2026-09-19T12:00:00-03:00|187,45|0,00|ABC|1|HASH';
  const result = parser.analyzeQrPayload(url);
  assert.equal(result.accessKey, key);
  assert.equal(result.total, 187.45);
  assert.equal(result.requiresPortal, false);
  assert.match(result.summaryText, /187,45/);
  assert.ok(result.summaryText.length <= 480);
});

test('QR fiscal online sem total mantém portal para validação humana', () => {
  const key = '35260912345678000123650010000012341000012345';
  const url = 'https://consulta.exemplo.gov.br/nfce?p=' + key + '|2|1|12|ABCDEF';
  const result = parser.analyzeQrPayload(url);
  assert.equal(result.accessKey, key);
  assert.equal(result.total, null);
  assert.equal(result.requiresPortal, true);
  assert.equal(result.portalMayRequireHumanVerification, true);
  assert.equal(result.url, url);
});

test('QR com valor explícito em query usa o valor sem consultar portal', () => {
  const result = parser.analyzeQrPayload('https://fiscal.exemplo.gov.br/consulta?vNF=98,70');
  assert.equal(result.total, 98.7);
  assert.equal(result.totalSource, 'query:vNF');
});

test('cupom extrai total e itens sem confundir linha de total', () => {
  const text = `
MERCADO CENTRAL LTDA
CNPJ 12.345.678/0001-90
ARROZ TIPO 1 25,90
FEIJAO CARIOCA 8,50
LEITE INTEGRAL 6,49
VALOR TOTAL R$ 40,89
19/09/2026 14:32
PIX 40,89
`;
  const result = parser.analyzeReceiptText(text);
  assert.equal(result.merchant, 'MERCADO CENTRAL LTDA');
  assert.equal(result.total, 40.89);
  assert.equal(result.date, '19/09/2026');
  assert.equal(result.itemCount, 3);
  assert.deepEqual(result.items.map(i => i.description), [
    'ARROZ TIPO 1',
    'FEIJAO CARIOCA',
    'LEITE INTEGRAL'
  ]);
});

test('cupom sem total explícito não inventa total', () => {
  const result = parser.analyzeReceiptText('LOJA TESTE\nPRODUTO A 12,90\nPRODUTO B 8,50');
  assert.equal(result.total, null);
  assert.equal(result.itemCount, 2);
});

test('parser monetário suporta formatos brasileiros comuns', () => {
  assert.equal(parser.parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parser.parseMoney('Total 89,90'), 89.9);
  assert.equal(parser.parseMoney('12.50'), 12.5);
});


test('OCR ruidoso ainda reconhece variações comuns de total', () => {
  const result = parser.analyzeReceiptText([
    '* E eua aaa as a o A E',
    'MERCADO BOM PRECO LTDA',
    'ARROZ 25,90',
    'FEIJAO 8,50',
    'VA1OR TOTA1 R$ 34,40',
    'PIX 34,40',
    '18/09/2026'
  ].join('\n'));
  assert.equal(result.merchant, 'MERCADO BOM PRECO LTDA');
  assert.equal(result.total, 34.4);
  assert.equal(result.totalStrategy, 'labeled-total');
  assert.ok(result.confidence.total >= 0.9);
});

test('resumo compacto de OCR nunca ultrapassa 500 caracteres', () => {
  const result = parser.analyzeReceiptText([
    'SUPERMERCADO EXEMPLO LTDA',
    ...Array.from({ length: 30 }, (_, i) => 'PRODUTO MUITO DETALHADO ' + i + ' 10,00'),
    'VALOR TOTAL R$ 300,00',
    '19/09/2026'
  ].join('\n'));
  const compact = parser.compactReceiptSummary(result);
  assert.ok(compact.length <= 480);
  assert.match(compact, /valor total/i);
  assert.match(compact, /300,00/);
});


test('lista de itens vira descrição compacta do lançamento', () => {
  const description = parser.buildItemsDescription([
    { description: 'ARROZ TIPO 1' },
    { description: 'FEIJAO CARIOCA' },
    { description: 'LEITE INTEGRAL' }
  ], 500);
  assert.equal(description, 'Itens: ARROZ TIPO 1; FEIJAO CARIOCA; LEITE INTEGRAL');
});

test('descrição de itens não corta no meio e informa excedentes', () => {
  const description = parser.buildItemsDescription([
    { description: 'PRODUTO MUITO LONGO NUMERO UM' },
    { description: 'PRODUTO MUITO LONGO NUMERO DOIS' },
    { description: 'PRODUTO MUITO LONGO NUMERO TRES' }
  ], 70);
  assert.ok(description.length <= 70);
  assert.match(description, /^Itens:/);
  assert.match(description, /\+\d+ itens?/);
});
