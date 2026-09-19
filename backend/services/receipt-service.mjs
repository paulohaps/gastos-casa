import { inspectFiscalReceipt } from '../receipts/nfce-parser.mjs';

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
    const receipt = inspectFiscalReceipt({
      qrPayload: String(payload?.qrPayload || '').slice(0, 4000),
      ocrText: String(payload?.ocrText || '').slice(0, 20000)
    });

    const duplicate = await findDuplicate(jwt, receipt.duplicateKey);
    return {
      ...receipt,
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
