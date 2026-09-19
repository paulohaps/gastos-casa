import { inspectFiscalReceipt } from '../receipts/nfce-parser.mjs';
import { fetchRoNfceByQr } from '../receipts/sefaz-ro-provider.mjs';


function buildSmartReceiptText(receipt, rawText = '') {
  const parts = [];
  if (receipt?.total != null) parts.push('Paguei ' + Number(receipt.total).toFixed(2).replace('.', ','));
  if (receipt?.issuer?.name) parts.push('em ' + receipt.issuer.name);
  if (receipt?.issueDate) {
    const [y,m,d] = String(receipt.issueDate).split('-');
    if (y && m && d) parts.push('no dia ' + d + '/' + m + '/' + y);
  }

  const cleanLines = String(rawText || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(line => line.length >= 3 && line.length <= 90)
    .filter(line => !/\b(cnpj|cpf|chave|danfe|nfce|nfc-e|subtotal|desconto|valor total|forma de pagamento|consumidor|tributos|comprovante|mastercard|visa|cielo|serie|série|emissao|emissão)\b/i.test(line))
    .filter(line => !/^\d[\d\s.,:/-]+$/.test(line))
    .filter(line => (line.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 3);

  const itemHints = [];
  for (const line of cleanLines) {
    const normalized = line.toLowerCase();
    if (receipt?.issuer?.name && normalized.includes(String(receipt.issuer.name).toLowerCase().slice(0, 12))) continue;
    if (itemHints.some(existing => existing.toLowerCase() === normalized)) continue;
    itemHints.push(line);
    if (itemHints.length >= 5) break;
  }

  if (itemHints.length) parts.push('Itens: ' + itemHints.join('; '));

  const text = parts.join('. ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 460);
}

function mergeReceipt(primary, secondary) {
  if (!secondary) return primary;
  return {
    ...primary,
    issuer: {
      cnpj: primary?.issuer?.cnpj || secondary?.issuer?.cnpj || null,
      name: primary?.issuer?.name || secondary?.issuer?.name || null
    },
    issueDate: primary?.issueDate || secondary?.issueDate || null,
    total: primary?.total ?? secondary?.total ?? null
  };
}

function safeEvidence(receipt) {
  return Array.isArray(receipt?.evidence)
    ? receipt.evidence.map(item => ({
        code: String(item.code || '').slice(0, 64),
        ok: item.ok === true
      })).slice(0, 20)
    : [];
}

export function createReceiptService({ dataApi }) {
  async function findDuplicate(jwt, duplicateKey) {
    if (!duplicateKey) return null;
    const res = await dataApi(
      '/receipt_imports?select=id,expense_id,access_key,issuer_name,total,issue_date,created_at&access_key=eq.' +
        encodeURIComponent(duplicateKey) +
        '&order=created_at.desc&limit=1',
      { method:'GET' },
      jwt
    );

    if (!res.ok) {
      const body = await res.text();
      // Migration may not have been applied yet. Inspection must remain usable.
      console.warn('[receipt:duplicate] lookup skipped:', res.status, body.slice(0,160));
      return null;
    }
    return JSON.parse(await res.text() || '[]')[0] || null;
  }

  async function inspect(jwt, payload) {
    const qrPayload = String(payload?.qrPayload || '').slice(0, 4000);
    const ocrText = String(payload?.ocrText || '').slice(0, 20000);

    let receipt = inspectFiscalReceipt({ qrPayload, ocrText });
    let authority = {
      status:'not_attempted',
      verified:false,
      captchaRequired:false
    };

    if (
      receipt?.state === 'RO' &&
      receipt?.verification?.url &&
      receipt?.source?.qr
    ) {
      const official = await fetchRoNfceByQr(
        receipt.verification.url,
        receipt.accessKey
      );

      authority = {
        status:official.status,
        verified:false,
        captchaRequired:official.status === 'captcha_required',
        httpStatus:official.httpStatus || null
      };

      if (official.status === 'fetched' && official.text) {
        const officialReceipt = inspectFiscalReceipt({
          qrPayload,
          ocrText:official.text
        });
        receipt = mergeReceipt(receipt, officialReceipt);

        const keyMatched = official.keyMatched === true ||
          officialReceipt?.accessKey === receipt.accessKey;

        authority.verified = Boolean(
          keyMatched &&
          receipt?.key?.validCheckDigit &&
          receipt?.total != null
        );
      }
    }

    const duplicate = await findDuplicate(jwt, receipt.duplicateKey);
    const smartText = buildSmartReceiptText(
      receipt,
      ocrText || (authority.verified ? '' : '')
    );

    return {
      ...receipt,
      verification:{
        ...receipt.verification,
        verifiedByAuthority:authority.verified,
        providerStatus:authority.status,
        captchaExpected:
          receipt.verification?.captchaExpected === true ||
          authority.captchaRequired
      },
      smartText,
      duplicate: duplicate
        ? {
            found:true,
            receiptImportId: duplicate.id,
            expenseId: duplicate.expense_id,
            issuerName: duplicate.issuer_name,
            total: duplicate.total != null ? Number(duplicate.total) : null,
            issueDate: duplicate.issue_date || null,
            createdAt: duplicate.created_at || null
          }
        : { found:false }
    };
  }

  async function registerFromExpense(jwt, expenseRow, receiptMeta) {
    if (!expenseRow || !receiptMeta?.accessKey || !receiptMeta?.validAccessKey) return null;

    const row = {
      expense_id: expenseRow.id || null,
      access_key: String(receiptMeta.accessKey).replace(/\D/g, '').slice(0,44),
      issuer_cnpj: receiptMeta.issuerCnpj ? String(receiptMeta.issuerCnpj).replace(/\D/g, '').slice(0,14) : null,
      issuer_name: receiptMeta.issuerName ? String(receiptMeta.issuerName).trim().slice(0,160) : null,
      issue_date: /^\d{4}-\d{2}-\d{2}$/.test(String(receiptMeta.issueDate || '')) ? receiptMeta.issueDate : null,
      total: Number.isFinite(Number(receiptMeta.total)) ? Number(receiptMeta.total) : null,
      source: ['qr','receipt','qr+receipt'].includes(receiptMeta.source) ? receiptMeta.source : 'qr',
      fiscal_status: String(receiptMeta.fiscalStatus || 'identified_key').slice(0,40),
      verification_mode: String(receiptMeta.verificationMode || 'unavailable').slice(0,40),
      evidence: safeEvidence(receiptMeta)
    };

    if (row.access_key.length !== 44) return null;

    const res = await dataApi('/receipt_imports?on_conflict=access_key', {
      method:'POST',
      headers:{ Prefer:'resolution=ignore-duplicates,return=representation' },
      body:JSON.stringify(row)
    }, jwt);

    const text = await res.text();
    if (!res.ok) {
      console.warn('[receipt:register] expense saved, fiscal metadata skipped:', res.status, text.slice(0,180));
      return null;
    }

    return JSON.parse(text || '[]')[0] || { duplicate:true };
  }

  return { inspect, findDuplicate, registerFromExpense };
}
