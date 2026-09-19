(function () {
  'use strict';

  const state = {
    current: null,
    qrPayload: '',
    ocrText: ''
  };

  let ctx = null;

  function init(options) {
    ctx = options;
    bind();
  }

  function maskedKey(key) {
    const digits = String(key || '').replace(/\D/g, '');
    if (digits.length !== 44) return '—';
    return digits.slice(0, 6) + '…' + digits.slice(-6);
  }

  function statusLabel(status) {
    const map = {
      identified_official_qr: 'QR fiscal identificado',
      identified_key: 'Chave fiscal identificada',
      unverified_image: 'Dados extraídos da imagem'
    };
    return map[status] || 'Cupom identificado';
  }

  function confidenceLabel(value) {
    return value === 'high' ? 'Alta consistência' : value === 'medium' ? 'Consistência média' : 'Revisão necessária';
  }

  function render() {
    const panel = document.getElementById('receiptEvidencePanel');
    if (!panel) return;
    const receipt = state.current;

    if (!receipt) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    const status = document.getElementById('receiptEvidenceStatus');
    const confidence = document.getElementById('receiptEvidenceConfidence');
    const issuer = document.getElementById('receiptEvidenceIssuer');
    const key = document.getElementById('receiptEvidenceKey');
    const duplicate = document.getElementById('receiptDuplicateWarning');
    const verify = document.getElementById('receiptVerifyButton');
    const evidence = document.getElementById('receiptEvidenceList');

    if (status) status.textContent = statusLabel(receipt.fiscalStatus);
    if (confidence) {
      confidence.textContent = confidenceLabel(receipt.confidence);
      confidence.className = 'status-badge ' +
        (receipt.confidence === 'high' ? 'status-badge--success' : receipt.confidence === 'medium' ? 'status-badge--warning' : 'status-badge--danger');
    }
    if (issuer) issuer.textContent = receipt.issuer?.name || receipt.issuer?.cnpj || 'Emitente não identificado';
    if (key) key.textContent = maskedKey(receipt.accessKey);

    if (duplicate) {
      duplicate.classList.toggle('hidden', !receipt.duplicate?.found);
      if (receipt.duplicate?.found) {
        duplicate.textContent = 'Este cupom já foi importado' +
          (receipt.duplicate.issueDate ? ' em ' + receipt.duplicate.issueDate.split('-').reverse().join('/') : '') +
          (receipt.duplicate.total != null ? ' • ' + ctx.formatCurrency(Number(receipt.duplicate.total)) : '') + '.';
      }
    }

    if (verify) {
      const url = receipt.verification?.url || '';
      verify.classList.toggle('hidden', !url);
      verify.onclick = () => {
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
      };
    }

    if (evidence) {
      evidence.innerHTML = '';
      (receipt.evidence || []).filter(item => item.ok).slice(0, 5).forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = '<i class="fa-solid fa-check"></i><span>' + ctx.escapeHTML(item.label || item.code || '') + '</span>';
        evidence.appendChild(li);
      });
    }
  }

  async function inspect(payload = {}) {
    state.qrPayload = String(payload.qrPayload || state.qrPayload || '');
    state.ocrText = String(payload.ocrText || '');
    state.current = await ctx.api.inspectReceipt({
      qrPayload: state.qrPayload,
      ocrText: state.ocrText
    });
    render();
    return state.current;
  }

  function setQrPayload(payload) {
    state.qrPayload = String(payload || '');
  }

  function getCurrent() {
    return state.current;
  }

  function getSubmissionMeta() {
    const r = state.current;
    if (!r?.accessKey || !r?.key?.validCheckDigit) return null;
    return {
      accessKey: r.accessKey,
      validAccessKey: true,
      issuerCnpj: r.issuer?.cnpj || null,
      issuerName: r.issuer?.name || null,
      issueDate: r.issueDate || null,
      total: r.total ?? null,
      source: r.source?.qr && r.source?.ocr ? 'qr+receipt' : r.source?.ocr ? 'receipt' : 'qr',
      fiscalStatus: r.fiscalStatus || 'identified_key',
      verificationMode: r.verification?.mode || 'unavailable',
      evidence: Array.isArray(r.evidence) ? r.evidence.map(x => ({ code:x.code, ok:x.ok === true })) : []
    };
  }

  function clear() {
    state.current = null;
    state.qrPayload = '';
    state.ocrText = '';
    render();
  }

  function afterExpenseSaved() {
    clear();
  }

  function bind() {
    document.getElementById('receiptVerifyButton')?.addEventListener('click', event => {
      const url = state.current?.verification?.url;
      if (!url) {
        event.preventDefault();
        ctx.showToast('A consulta oficial precisa ser aberta manualmente pela chave.', true);
      }
    });
  }

  window.GastosReceiptImport = {
    init,
    inspect,
    render,
    clear,
    getCurrent,
    getSubmissionMeta,
    setQrPayload,
    afterExpenseSaved
  };
})();
