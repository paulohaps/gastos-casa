(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GastosReceiptParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TOTAL_LABELS = [
    /\bvalor\s+total\b/i,
    /\btotal\s+a\s+pagar\b/i,
    /\bvalor\s+a\s+pagar\b/i,
    /^\s*total\b/i
  ];

  const NON_ITEM = [
    /\b(cnpj|cpf|chave|nfc-e|nfce|danfe|documento auxiliar|tribut|imposto|icms|troco|pagamento|cart[aã]o|pix|dinheiro|subtotal|desconto|acrescimo|valor total|total a pagar|valor a pagar)\b/i,
    /^\s*(qtd|qtde|quantidade|item|cod|c[oó]digo|descri[cç][aã]o|vl\.?\s*unit)/i
  ];

  function normalizeSpace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseMoney(value) {
    const raw = String(value || '').replace(/R\$\s*/gi, '').trim();
    const matches = raw.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+(?:[.,]\d{2})/g);
    if (!matches?.length) return null;
    const token = matches[matches.length - 1];
    const normalized = token.includes(',')
      ? token.replace(/\./g, '').replace(',', '.')
      : token;
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
  }

  function moneyBR(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function extractAccessKey(value) {
    const compact = String(value || '').replace(/\D/g, '');
    const match = compact.match(/\d{44}/);
    return match?.[0] || null;
  }

  function explicitQueryTotal(url) {
    const keys = ['vNF', 'valor', 'valorTotal', 'total', 'amount', 'value'];
    for (const key of keys) {
      const raw = url.searchParams.get(key);
      const parsed = parseMoney(raw);
      if (parsed !== null && parsed > 0) return { value: parsed, source: 'query:' + key };
    }
    return null;
  }

  function parsePipePayload(p) {
    const parts = String(p || '').split('|');
    if (parts.length < 5) return null;
    const version = parts[1] || null;
    // NFC-e QR offline v2 normally has 9+ fields and vNF in the fifth field.
    if (parts.length >= 9) {
      const total = parseMoney(parts[4]);
      if (total !== null && total > 0) {
        return { value: total, source: 'offline-payload-v' + (version || '?') };
      }
    }
    return null;
  }

  function compactQrSummary(analysis) {
    const parts = ['NFC-e lida por QR'];
    if (analysis.accessKey) parts.push('chave ' + analysis.accessKey);
    if (analysis.total) parts.push('valor total ' + moneyBR(analysis.total));
    if (analysis.host) parts.push('portal ' + analysis.host);
    const text = parts.join('; ');
    return text.slice(0, 480);
  }

  function analyzeQrPayload(payload) {
    const raw = String(payload || '').trim();
    let url = null;
    try {
      const parsed = new URL(raw);
      if (/^https?:$/.test(parsed.protocol)) url = parsed;
    } catch {}

    let totalInfo = null;
    if (url) {
      totalInfo = explicitQueryTotal(url);
      if (!totalInfo) totalInfo = parsePipePayload(url.searchParams.get('p'));
    } else {
      const pipe = raw.includes('|') ? raw : '';
      totalInfo = parsePipePayload(pipe);
    }

    const accessKey = extractAccessKey(url?.searchParams.get('p') || raw);
    const result = {
      kind: url ? 'fiscal-url' : 'qr-text',
      raw,
      url: url?.toString() || null,
      host: url?.hostname || null,
      accessKey,
      total: totalInfo?.value || null,
      totalSource: totalInfo?.source || null,
      requiresPortal: Boolean(url && !totalInfo?.value),
      portalMayRequireHumanVerification: Boolean(url && !totalInfo?.value)
    };
    result.summaryText = compactQrSummary(result);
    return result;
  }

  function extractTotal(lines) {
    for (const line of lines) {
      if (!TOTAL_LABELS.some(re => re.test(line))) continue;
      const value = parseMoney(line);
      if (value !== null && value > 0) return { value, line };
    }
    return { value: null, line: null };
  }

  function likelyMerchant(lines) {
    for (const line of lines.slice(0, 12)) {
      const clean = normalizeSpace(line);
      if (clean.length < 4 || clean.length > 80) continue;
      if (/\b(cnpj|cpf|danfe|nfc-e|nfce|cupom fiscal|documento auxiliar|endereco|telefone)\b/i.test(clean)) continue;
      if (/^\d/.test(clean)) continue;
      return clean;
    }
    return null;
  }

  function extractDate(text) {
    const match = String(text || '').match(/\b([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2})\b/);
    if (!match) return null;
    const day = String(match[1]).padStart(2, '0');
    const month = String(match[2]).padStart(2, '0');
    return day + '/' + month + '/' + match[3];
  }

  function cleanItemDescription(raw) {
    return normalizeSpace(String(raw || '')
      .replace(/^\s*\d{1,4}\s+/, '')
      .replace(/\b(?:UN|UND|KG|G|LT|L|ML|PC|PCT)\b\s*$/i, '')
      .replace(/[|]+/g, ' '));
  }

  function extractItems(lines, totalLine) {
    const items = [];
    for (const line of lines) {
      const clean = normalizeSpace(line);
      if (!clean || clean === totalLine) continue;
      if (NON_ITEM.some(re => re.test(clean))) continue;

      const match = clean.match(/^(.{3,}?)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*$/i);
      if (!match) continue;
      const description = cleanItemDescription(match[1]);
      const total = parseMoney(match[2]);
      if (!description || description.length < 3 || total === null || total <= 0) continue;
      if (/^[\d\W]+$/.test(description)) continue;

      items.push({
        description,
        total,
        confidence: 0.74
      });
    }

    const seen = new Set();
    return items.filter(item => {
      const key = item.description.toLowerCase() + '|' + item.total.toFixed(2);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
  }

  function analyzeReceiptText(text) {
    const raw = String(text || '').trim();
    const lines = raw.split(/\r?\n/)
      .map(normalizeSpace)
      .filter(Boolean);

    const totalInfo = extractTotal(lines);
    const items = extractItems(lines, totalInfo.line);
    return {
      merchant: likelyMerchant(lines),
      date: extractDate(raw),
      total: totalInfo.value,
      totalLine: totalInfo.line,
      items,
      itemCount: items.length,
      confidence: {
        total: totalInfo.value ? 0.94 : 0.35,
        items: items.length >= 2 ? 0.78 : (items.length ? 0.62 : 0.25)
      },
      raw
    };
  }

  return Object.freeze({
    analyzeQrPayload,
    analyzeReceiptText,
    parseMoney,
    extractAccessKey
  });
});
