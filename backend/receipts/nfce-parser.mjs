const UF_CODES = {
  '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
  '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
  '31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS',
  '50':'MS','51':'MT','52':'GO','53':'DF'
};

const OFFICIAL_HOST_PATTERNS = [
  /(^|\.)nfce\.sefin\.ro\.gov\.br$/i,
  /(^|\.)sefin\.ro\.gov\.br$/i,
  /(^|\.)fazenda\.gov\.br$/i,
  /(^|\.)sefaz\.[a-z]{2}\.gov\.br$/i
];

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function calculateAccessKeyDigit(first43) {
  const digits = onlyDigits(first43);
  if (digits.length !== 43) return null;
  let weight = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const digit = 11 - remainder;
  return digit >= 10 ? 0 : digit;
}

export function isValidAccessKey(value) {
  const key = onlyDigits(value);
  if (key.length !== 44) return false;
  const expected = calculateAccessKeyDigit(key.slice(0, 43));
  return expected != null && Number(key[43]) === expected;
}

export function parseAccessKey(value) {
  const key = onlyDigits(value);
  if (key.length !== 44) return null;
  const ufCode = key.slice(0, 2);
  return {
    key,
    validCheckDigit: isValidAccessKey(key),
    ufCode,
    uf: UF_CODES[ufCode] || null,
    aamm: key.slice(2, 6),
    issuerCnpj: key.slice(6, 20),
    model: key.slice(20, 22),
    series: key.slice(22, 25),
    number: key.slice(25, 34),
    emissionType: key.slice(34, 35),
    numericCode: key.slice(35, 43),
    checkDigit: key.slice(43, 44)
  };
}

function findAccessKeyInText(text) {
  const raw = String(text || '');
  const candidates = [];

  // Printed DANFE keys are commonly formatted as 11 groups of 4 digits.
  for (const match of raw.match(/\b(?:\d{4}[\s.-]+){10}\d{4}\b/g) || []) {
    const key = onlyDigits(match);
    if (key.length === 44) candidates.push(key);
  }

  // Also accept a compact 44-digit key.
  for (const match of raw.match(/\b\d{44}\b/g) || []) {
    candidates.push(match);
  }

  // OCR can insert irregular separators. Generate sliding 44-digit candidates
  // only inside number-heavy fragments, then prefer a valid check digit.
  for (const fragment of raw.match(/(?:\d[\s.-]?){44,}/g) || []) {
    const digits = onlyDigits(fragment);
    for (let i = 0; i + 44 <= digits.length; i++) {
      candidates.push(digits.slice(i, i + 44));
    }
  }

  const unique = [...new Set(candidates)];
  return unique.find(isValidAccessKey) || unique[0] || null;
}

function parseMoney(value) {
  if (value == null) return null;
  const raw = String(value).trim().replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.');
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

function parseDate(text) {
  const match = String(text || '').match(/\b([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2}|\d{2})\b/);
  if (!match) return null;
  const year = match[3].length === 2 ? '20' + match[3] : match[3];
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractTotalFromText(text) {
  const lines = String(text || '').split(/\r?\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const patterns = [
    /\bvalor\s+total\b/i,
    /\btotal\s+a\s+pagar\b/i,
    /\bvalor\s+a\s+pagar\b/i,
    /^total\b/i
  ];
  const candidates = [];
  for (const line of lines) {
    if (!patterns.some(re => re.test(line))) continue;
    const values = [...line.matchAll(/(?:R\$\s*)?(\d{1,7}(?:[.,]\d{2}))/gi)]
      .map(m => parseMoney(m[1]))
      .filter(v => v != null);
    if (values.length) candidates.push(values.at(-1));
  }
  return candidates.length ? candidates.at(-1) : null;
}

function extractIssuerCnpj(text) {
  const match = String(text || '').match(/\bCNPJ\s*[:\-]?\s*((?:\d[.\/-]?){14,18})/i);
  const digits = match ? onlyDigits(match[1]) : null;
  return digits && digits.length === 14 ? digits : null;
}

function extractIssuerName(text) {
  const lines = String(text || '').split(/\r?\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const blacklist = /\b(cnpj|cpf|nfce|nfc-e|danfe|documento|cupom|subtotal|desconto|valor total|forma de pagamento|consumidor|chave de acesso|tributos|comprovante|mastercard|visa|cielo)\b/i;
  return lines.find(line =>
    line.length >= 4 &&
    line.length <= 100 &&
    /[A-Za-zÀ-ÿ]{3}/.test(line) &&
    !blacklist.test(line)
  ) || null;
}

function parseQrPayload(payload) {
  const raw = String(payload || '').trim();
  if (!raw) return null;

  let url = null;
  try { url = new URL(raw); } catch {}

  let accessKey = null;
  let amount = null;
  let date = null;
  let officialDomain = false;
  let verificationUrl = null;
  let environment = null;

  if (url) {
    officialDomain = OFFICIAL_HOST_PATTERNS.some(re => re.test(url.hostname));
    verificationUrl = officialDomain ? url.toString() : null;

    for (const key of ['chNFe','chave','accessKey']) {
      const value = url.searchParams.get(key);
      if (value && onlyDigits(value).length === 44) {
        accessKey = onlyDigits(value);
        break;
      }
    }

    const p = url.searchParams.get('p');
    if (p) {
      const decoded = decodeURIComponent(p);
      const parts = decoded.split('|');
      const possibleKey = onlyDigits(parts[0] || '');
      if (!accessKey && possibleKey.length === 44) accessKey = possibleKey;
      if (parts[2] && /^[12]$/.test(parts[2])) environment = parts[2];

      // NFC-e offline QR v2/v3 commonly carries vNF in the documented payload.
      const offlineAmount = parseMoney(parts[4]);
      if (offlineAmount != null && offlineAmount > 0) amount = offlineAmount;
    }

    for (const key of ['vNF','valor','total','vTotal']) {
      const value = parseMoney(url.searchParams.get(key));
      if (value != null && value > 0) {
        amount = value;
        break;
      }
    }

    for (const key of ['dhEmi','data','date']) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      const iso = String(value).match(/(20\d{2})-(\d{2})-(\d{2})/);
      if (iso) {
        date = `${iso[1]}-${iso[2]}-${iso[3]}`;
        break;
      }
    }
  }

  if (!accessKey) accessKey = findAccessKeyInText(raw);

  return {
    rawType: url ? 'url' : 'text',
    accessKey,
    amount,
    date,
    officialDomain,
    verificationUrl,
    environment
  };
}

function confidenceFromEvidence(evidence) {
  const score = evidence.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function inspectFiscalReceipt({ qrPayload = '', ocrText = '' } = {}) {
  const qr = parseQrPayload(qrPayload);
  const text = String(ocrText || '').trim();

  const textKey = findAccessKeyInText(text);
  const accessKey = qr?.accessKey || textKey || null;
  const keyData = accessKey ? parseAccessKey(accessKey) : null;

  const textTotal = extractTotalFromText(text);
  const total = qr?.amount ?? textTotal ?? null;
  const issueDate = qr?.date || parseDate(text);
  const issuerCnpjText = extractIssuerCnpj(text);
  const issuerCnpj = keyData?.issuerCnpj || issuerCnpjText || null;
  const issuerName = extractIssuerName(text);

  const cnpjMatchesKey = Boolean(
    keyData?.issuerCnpj &&
    issuerCnpjText &&
    keyData.issuerCnpj === issuerCnpjText
  );

  const evidence = [
    { code:'ACCESS_KEY_44', label:'Chave de acesso encontrada', ok:Boolean(accessKey), weight:20 },
    { code:'ACCESS_KEY_DV', label:'Dígito verificador da chave válido', ok:Boolean(keyData?.validCheckDigit), weight:20 },
    { code:'OFFICIAL_QR_DOMAIN', label:'QR aponta para domínio fiscal oficial', ok:Boolean(qr?.officialDomain), weight:15 },
    { code:'TOTAL_FOUND', label:'Valor total identificado', ok:Number.isFinite(total), weight:15 },
    { code:'DATE_FOUND', label:'Data identificada', ok:Boolean(issueDate), weight:10 },
    { code:'CNPJ_FOUND', label:'CNPJ do emitente identificado', ok:Boolean(issuerCnpj), weight:10 },
    { code:'CNPJ_MATCH', label:'CNPJ impresso confere com a chave', ok:cnpjMatchesKey, weight:5 },
    { code:'ISSUER_FOUND', label:'Estabelecimento identificado', ok:Boolean(issuerName), weight:5 }
  ];

  const duplicateKey = keyData?.validCheckDigit ? keyData.key : null;
  const state = keyData?.uf || null;
  const fiscalStatus = qr?.officialDomain && keyData?.validCheckDigit
    ? 'identified_official_qr'
    : keyData?.validCheckDigit
      ? 'identified_key'
      : 'unverified_image';

  return {
    kind:'nfce',
    fiscalStatus,
    confidence: confidenceFromEvidence(evidence),
    accessKey: accessKey || null,
    duplicateKey,
    key: keyData,
    state,
    issuer: {
      cnpj: issuerCnpj,
      name: issuerName
    },
    issueDate,
    total,
    evidence,
    verification: {
      mode: qr?.verificationUrl ? 'assisted-url' : accessKey ? 'manual-key' : 'unavailable',
      url: qr?.verificationUrl || (state === 'RO' && accessKey ? 'https://www.nfce.sefin.ro.gov.br/' : null),
      captchaExpected: state === 'RO',
      verifiedByAuthority: false
    },
    source: {
      qr: Boolean(qrPayload),
      ocr: Boolean(text)
    }
  };
}
