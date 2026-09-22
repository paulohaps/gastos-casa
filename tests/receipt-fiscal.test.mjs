import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAccessKeyDigit,
  isValidAccessKey,
  parseAccessKey,
  inspectFiscalReceipt
} from '../backend/receipts/nfce-parser.mjs';

const SAMPLE_KEY = '11260904082624000822650100009174851071923795';

test('valida a chave real de NFC-e do cupom de exemplo', () => {
  assert.equal(SAMPLE_KEY.length, 44);
  assert.equal(calculateAccessKeyDigit(SAMPLE_KEY.slice(0,43)), 5);
  assert.equal(isValidAccessKey(SAMPLE_KEY), true);
});

test('decodifica campos estruturais da chave de acesso', () => {
  const parsed = parseAccessKey(SAMPLE_KEY);
  assert.equal(parsed.uf, 'RO');
  assert.equal(parsed.issuerCnpj, '04082624000822');
  assert.equal(parsed.model, '65');
  assert.equal(parsed.series, '010');
  assert.equal(parsed.number, '000917485');
  assert.equal(parsed.validCheckDigit, true);
});

test('cruza OCR do cupom com a chave fiscal', () => {
  const ocrText = `
IRMAOS GONCALVES COMERCIO E INDUSTRIA LTDA
CNPJ: 04.082.624/0008-22
Data: 19/09/2026 07:50:33
VALOR TOTAL 14,01
1126 0904 0826 2400 0822 6501 0000 9174 8510 7192 3795
`;
  const result = inspectFiscalReceipt({ ocrText });
  assert.equal(result.accessKey, SAMPLE_KEY);
  assert.equal(result.key.validCheckDigit, true);
  assert.equal(result.state, 'RO');
  assert.equal(result.issuer.cnpj, '04082624000822');
  assert.equal(result.total, 14.01);
  assert.equal(result.issueDate, '2026-09-19');
  assert.equal(result.verification.verifiedByAuthority, false);
});

test('reconhece QR oficial e mantém validação como assistida, não automática', () => {
  const qrPayload = 'https://www.nfce.sefin.ro.gov.br/consultanfce/qrCode?p=' +
    encodeURIComponent(SAMPLE_KEY + '|2|1|x|14.01|x|x|x');
  const result = inspectFiscalReceipt({ qrPayload });
  assert.equal(result.accessKey, SAMPLE_KEY);
  assert.equal(result.key.validCheckDigit, true);
  assert.equal(result.verification.mode, 'assisted-url');
  assert.equal(result.verification.captchaExpected, true);
  assert.equal(result.verification.verifiedByAuthority, false);
  assert.equal(result.fiscalStatus, 'identified_official_qr');
});

test('chave com dígito verificador errado não vira chave de deduplicação', () => {
  const invalid = SAMPLE_KEY.slice(0,43) + '4';
  const result = inspectFiscalReceipt({ ocrText: invalid + '\nVALOR TOTAL 14,01' });
  assert.equal(result.key.validCheckDigit, false);
  assert.equal(result.duplicateKey, null);
});
