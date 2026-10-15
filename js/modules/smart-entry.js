(function () {
  'use strict';

  const state = {
    draft: null,
    result: null,
    appliedToForm: false,
    speechRecognition: null,
    speechListening: false,
    voicePendingInterpretation: false,
    pendingInputMode: null
  };

  let ctx = null;

  function requireContext() {
    if (!ctx) throw new Error('SmartEntryModule não inicializado.');
  }

  function init(options) {
    ctx = options;
    requireContext();
    configurarSmartEntry();
  }

function formatarDataIsoBr(dataIso) {
    if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return '—';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function parseDataBrLocal(dataBr) {
    const [dia, mes, ano] = String(dataBr || '').split('/').map(Number);
    if (!dia || !mes || !ano) return null;
    const date = new Date(ano, mes - 1, dia);
    return Number.isNaN(date.getTime()) ? null : date;
}

function encontrarDuplicidadeSmart(draft) {
    if (!draft?.valor || !draft?.descricao || !draft?.data) return null;
    const dataDraft = new Date(draft.data + 'T12:00:00');
    const descricao = ctx.normalizeText(draft.descricao);
    return ctx.getCurrentExpenses().find(item => {
        const mesmoValor = Math.abs((Number(item.valor) || 0) - Number(draft.valor)) < 0.01;
        const mesmaDescricao = ctx.normalizeText(item.descricao) === descricao;
        const dataItem = parseDataBrLocal(item.data);
        const diffDias = dataItem ? Math.abs(dataItem - dataDraft) / 86400000 : 99;
        return mesmoValor && mesmaDescricao && diffDias <= 1;
    }) || null;
}

async function carregarSmartEntryFeature() {
    const painel = document.getElementById('smartEntryPanel');
    const divider = document.getElementById('smartEntryDivider');
    if (!painel || !divider) return;
    try {
        const features = await ctx.api.fetchFeatures();
        const enabled = features?.smartEntry === true;
        painel.classList.toggle('hidden', !enabled);
        divider.classList.toggle('hidden', !enabled);
        if (enabled) {
            carregarRegrasSmart();
            if (features?.smartEntryTelemetry !== false) carregarMetricasSmart();
        }
    } catch (error) {
        console.warn('Smart Entry indisponível:', error);
        painel.classList.add('hidden');
        divider.classList.add('hidden');
    }
}

function limparSmartEntryPreview() {
    state.draft = null;
    state.result = null;
    state.appliedToForm = false;
    const preview = document.getElementById('smartEntryPreview');
    if (preview) preview.classList.add('hidden');
}

function preencherFormularioComSmartDraft(draft, { scroll = true } = {}) {
    if (!draft) return false;
    ctx.cancelEdit();
    state.appliedToForm = true;
    const data = document.getElementById('inputData');
    const valor = document.getElementById('inputValor');
    const descricao = document.getElementById('inputDescricao');
    const categoria = document.getElementById('inputCategoria');
    const forma = document.getElementById('inputFormaPagamento');

    if (data && draft.data) data.value = draft.data;
    if (valor) valor.value = draft.valor ?? '';
    if (descricao) descricao.value = draft.descricao || '';
    if (categoria && ctx.categories.includes(draft.categoria)) categoria.value = draft.categoria;
    if (forma && ['Dinheiro','Vale'].includes(draft.formaPagamento)) forma.value = draft.formaPagamento;

    if (scroll) {
        const form = document.getElementById('formGasto');
        const mobile = window.matchMedia?.('(max-width: 900px)')?.matches;
        form?.scrollIntoView({ behavior: 'smooth', block: mobile ? 'start' : 'center' });
        if (!mobile) setTimeout(() => valor?.focus({ preventScroll: true }), 320);
    }
    return true;
}

function confidenceLabel(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return '—';
    if (value >= 0.9) return 'Alta';
    if (value >= 0.7) return 'Boa';
    if (value >= 0.55) return 'Média';
    return 'Baixa';
}

function confidenceClass(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return 'confidence--unknown';
    if (value >= 0.9) return 'confidence--high';
    if (value >= 0.7) return 'confidence--good';
    if (value >= 0.55) return 'confidence--medium';
    return 'confidence--low';
}

function setFieldConfidence(field, score) {
    const el = document.querySelector('[data-smart-confidence="' + field + '"]');
    if (!el) return;
    el.className = 'smart-confidence ' + confidenceClass(score);
    el.textContent = confidenceLabel(score);
    el.title = Number.isFinite(Number(score)) ? Math.round(Number(score) * 100) + '% de confiança' : '';
}

function renderSmartEntryPreview(result) {
    const preview = document.getElementById('smartEntryPreview');
    if (!preview) return;

    if (!result || result.intent !== 'expense' || !result.draft) {
        preview.classList.add('hidden');
        const message = result?.warnings?.[0]?.message || 'Não consegui interpretar isso como um novo gasto.';
        ctx.showToast(message, true);
        return;
    }

    document.getElementById('smartEntryPanel').open = true;
    state.result = result;
    state.draft = result.draft;
    state.appliedToForm = false;

    document.getElementById('smartEntryPreviewTitle').textContent = 'Prévia do lançamento';
    const descricaoSmart = document.getElementById('smartEntryDescricao');
    if (descricaoSmart) descricaoSmart.textContent = state.draft.descricao || 'Revisar';
    document.getElementById('smartEntryValor').textContent = state.draft.valor ? ctx.formatCurrency(Number(state.draft.valor)) : 'Revisar';
    document.getElementById('smartEntryCategoria').textContent = state.draft.categoria || 'Revisar';
    document.getElementById('smartEntryPagamento').textContent = state.draft.formaPagamento === 'Vale' ? 'Vale' : 'Dinheiro / PIX / Cartão';
    document.getElementById('smartEntryData').textContent = formatarDataIsoBr(state.draft.data);

    const merchantEl = document.getElementById('smartEntryEstabelecimento');
    const merchantWrap = document.getElementById('smartEntryMerchantWrap');
    if (merchantEl && merchantWrap) {
        const merchant = state.draft.estabelecimento || '';
        merchantEl.textContent = merchant || 'Não identificado';
        merchantWrap.classList.toggle('hidden', !merchant);
    }

    const sourceEl = document.getElementById('smartEntrySource');
    if (sourceEl) {
        const mode = result?.input?.mode || 'text';
        const labels = { text: 'Texto', voice: 'Voz', camera: 'Câmera', qr: 'QR', receipt: 'Cupom' };
        sourceEl.textContent = labels[mode] || 'Texto';
    }

    const confidence = result?.confidence || {};
    setFieldConfidence('valor', confidence.valor);
    setFieldConfidence('descricao', confidence.descricao);
    setFieldConfidence('categoria', confidence.categoria);
    setFieldConfidence('formaPagamento', confidence.formaPagamento);
    setFieldConfidence('data', confidence.data);

    const overall = document.getElementById('smartEntryOverallConfidence');
    if (overall) {
        overall.className = 'smart-entry-confidence-summary ' + confidenceClass(confidence.overall);
        overall.textContent = 'Confiança ' + confidenceLabel(confidence.overall);
        overall.title = Number.isFinite(Number(confidence.overall)) ? Math.round(Number(confidence.overall) * 100) + '% de confiança geral' : '';
    }

    const reviewBadge = document.getElementById('smartEntryReviewBadge');
    reviewBadge.className = 'status-badge ' + (result.needsReview ? 'status-badge--warning' : 'status-badge--success');
    reviewBadge.textContent = result.needsReview ? 'Revisar' : 'Pronto';

    const warnings = document.getElementById('smartEntryWarnings');
    const warningItems = Array.isArray(result.warnings) ? result.warnings : [];
    warnings.innerHTML = '';
    warnings.classList.toggle('hidden', warningItems.length === 0);
    warningItems.forEach(item => {
        const p = document.createElement('p');
        p.innerHTML = '<i class="fa-solid fa-circle-info"></i><span>' + ctx.escapeHTML(item.message || '') + '</span>';
        warnings.appendChild(p);
    });

    const duplicate = encontrarDuplicidadeSmart(state.draft);
    const duplicateBox = document.getElementById('smartEntryDuplicateWarning');
    if (duplicate) {
        duplicateBox.classList.remove('hidden');
        duplicateBox.innerHTML =
            '<i class="fa-solid fa-copy"></i><div><strong>Possível duplicidade</strong><span>' +
            ctx.escapeHTML(duplicate.descricao) + ' • ' + ctx.formatCurrency(Number(duplicate.valor) || 0) + ' • ' + ctx.escapeHTML(duplicate.data) +
            '</span></div>';
    } else {
        duplicateBox.classList.add('hidden');
        duplicateBox.innerHTML = '';
    }

    const confirm = document.getElementById('btnConfirmarSmart');
    const valid = Number(state.draft.valor) > 0 &&
        Boolean(state.draft.descricao) &&
        ctx.categories.includes(state.draft.categoria) &&
        ['Dinheiro','Vale'].includes(state.draft.formaPagamento) &&
        /^\d{4}-\d{2}-\d{2}$/.test(state.draft.data || '');
    confirm.disabled = !valid;

    preview.classList.remove('hidden');
}

async function interpretarSmartEntry() {
    const input = document.getElementById('smartEntryText');
    const button = document.getElementById('btnInterpretarSmart');
    const text = input?.value?.trim() || '';
    if (text.length < 3) return ctx.showToast('Descreva o gasto antes de interpretar.', true);

    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Interpretando...';
    try {
        const inputMode = state.pendingInputMode || (state.voicePendingInterpretation ? 'voice' : 'text');
        const result = await ctx.api.parseSmartEntry(text, inputMode);
        state.pendingInputMode = null;
        renderSmartEntryPreview(result);
        if (state.voicePendingInterpretation) {
            setSmartVoiceState(false, 'Transcrição interpretada. Revise os dados e confirme.');
            state.voicePendingInterpretation = false;
        }
    } catch (error) {
        limparSmartEntryPreview();
        if (state.voicePendingInterpretation) {
            setSmartVoiceState(false, 'A transcrição foi concluída, mas a interpretação falhou. Você pode editar o texto e tentar novamente.');
            state.voicePendingInterpretation = false;
        }
        ctx.showToast(error?.message || 'Não foi possível interpretar o gasto.', true);
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

async function interpretarEntradaExterna(text, inputMode = 'receipt') {
    const input = document.getElementById('smartEntryText');
    const normalized = String(text || '').trim();
    if (normalized.length < 3) {
        ctx.showToast('Não encontrei texto suficiente para interpretar.', true);
        return null;
    }

    try {
        const result = await ctx.api.parseSmartEntry(
            normalized.slice(0, ['receipt','camera'].includes(inputMode) ? 12000 : 500),
            inputMode
        );
        renderSmartEntryPreview(result);

        if (input && result?.draft) {
            const summary = [
                result.draft.descricao,
                result.draft.valor ? ctx.formatCurrency(Number(result.draft.valor)) : null
            ].filter(Boolean).join(' • ');
            input.value = summary;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return result;
    } catch (error) {
        limparSmartEntryPreview();
        ctx.showToast(error?.message || 'Não foi possível interpretar a leitura.', true);
        throw error;
    }
}

function setSmartVoiceState(listening, message = '') {
    state.speechListening = listening === true;
    const button = document.getElementById('btnFalarSmart');
    const status = document.getElementById('smartVoiceStatus');
    if (button) {
        button.classList.toggle('is-listening', state.speechListening);
        button.setAttribute('aria-pressed', state.speechListening ? 'true' : 'false');
        button.innerHTML = state.speechListening
            ? '<svg aria-hidden="true" class="ui-icon"><use href="#i-stop"></use></svg><span>Parar</span>'
            : '<svg aria-hidden="true" class="ui-icon"><use href="#i-mic"></use></svg><span>Falar</span>';
    }
    if (status) {
        status.textContent = message || '';
        status.classList.toggle('hidden', !message);
    }
}

function smartSpeechErrorMessage(code) {
    const messages = {
        'not-allowed': 'Permissão do microfone negada. Libere o microfone para este site ou use o microfone do teclado.',
        'service-not-allowed': 'A transcrição por voz não está liberada neste navegador.',
        'no-speech': 'Não ouvi nenhuma fala. Toque em Falar e tente novamente.',
        'audio-capture': 'Não encontrei um microfone disponível.',
        'network': 'A transcrição por voz ficou indisponível. Você ainda pode digitar normalmente.'
    };
    return messages[code] || 'Não foi possível transcrever agora. Você ainda pode digitar normalmente.';
}

function iniciarDitadoSmart() {
    const input = document.getElementById('smartEntryText');
    if (!input) return;

    if (state.speechListening && state.speechRecognition) {
        try { state.speechRecognition.stop(); } catch {}
        return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
        input.focus({ preventScroll: true });
        setSmartVoiceState(false, 'Neste navegador, use o microfone do teclado para ditar o gasto.');
        return;
    }

    const prefix = input.value.trim();
    let finalText = '';
    let hadError = false;
    const recognition = new Recognition();
    state.speechRecognition = recognition;

    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        setSmartVoiceState(true, 'Ouvindo… fale o gasto naturalmente.');
    };

    recognition.onresult = event => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i]?.[0]?.transcript || '';
            if (event.results[i].isFinal) finalText += transcript + ' ';
            else interim += transcript;
        }
        input.value = [prefix, finalText.trim(), interim.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    recognition.onerror = event => {
        hadError = true;
        const message = smartSpeechErrorMessage(event.error);
        setSmartVoiceState(false, message);
        if (event.error !== 'aborted') ctx.showToast(message, true);
    };

    recognition.onend = () => {
        state.speechRecognition = null;
        const transcribed = finalText.trim();
        if (!hadError && transcribed) {
            state.voicePendingInterpretation = true;
            setSmartVoiceState(false, 'Transcrição pronta. Interpretando o gasto…');
            setTimeout(() => interpretarSmartEntry(), 120);
        } else if (!hadError) {
            setSmartVoiceState(false, 'Toque em Falar para tentar novamente.');
        }
    };

    try {
        recognition.start();
    } catch (error) {
        state.speechRecognition = null;
        const message = 'Não foi possível iniciar o microfone agora.';
        setSmartVoiceState(false, message);
        ctx.showToast(message, true);
    }
}

function configurarSmartEntry() {
    const panel = document.getElementById('smartEntryPanel');
    if (!panel || panel.dataset.bound === 'true') return;
    panel.dataset.bound = 'true';

    document.getElementById('btnInterpretarSmart')?.addEventListener('click', interpretarSmartEntry);
    document.getElementById('btnFalarSmart')?.addEventListener('click', iniciarDitadoSmart);
    document.getElementById('smartEntryText')?.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            interpretarSmartEntry();
        }
    });

    document.getElementById('btnEditarSmart')?.addEventListener('click', () => {
        if (!state.draft) return;
        preencherFormularioComSmartDraft(state.draft, { scroll: true });
    });

    document.getElementById('btnConfirmarSmart')?.addEventListener('click', () => {
        if (!state.draft) return;
        const ok = preencherFormularioComSmartDraft(state.draft, { scroll: false });
        if (!ok) return;
        const form = document.getElementById('formGasto');
        if (!form?.reportValidity()) {
            form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        form.requestSubmit();
    });
}

function carregarMetricasSmart() {
    window.dispatchEvent(new CustomEvent('gastos:metricsload'));
}

// Compatibility events: React owns settings and the rules form.
function carregarRegrasSmart() {
    window.dispatchEvent(new CustomEvent('gastos:rulesload'));
}
function toggleSmartRuleForm(forceOpen, termo = '', categoria = 'Outros') {
    window.dispatchEvent(new CustomEvent('gastos:rulestoggle', { detail: { open: forceOpen, term: termo, category: categoria } }));
}

  function applyExternalOverrides(overrides = {}) {
    if (!state.result?.draft || !state.draft) return false;

    if (typeof overrides.descricao === 'string' && overrides.descricao.trim()) {
      state.draft.descricao = overrides.descricao.trim().slice(0, 500);
      state.result.draft.descricao = state.draft.descricao;
    }
    if (typeof overrides.estabelecimento === 'string' && overrides.estabelecimento.trim()) {
      state.draft.estabelecimento = overrides.estabelecimento.trim().slice(0, 120);
      state.result.draft.estabelecimento = state.draft.estabelecimento;
    }
    if (Number(overrides.valor) > 0) {
      state.draft.valor = Number(overrides.valor);
      state.result.draft.valor = state.draft.valor;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(overrides.dataBr || ''))) {
      const [dia, mes, ano] = String(overrides.dataBr).split('/');
      state.draft.data = ano + '-' + mes + '-' + dia;
      state.result.draft.data = state.draft.data;
    }

    renderSmartEntryPreview(state.result);
    return true;
  }

  function getSubmissionMeta(isEditing) {
    if (isEditing || !state.appliedToForm || !state.result) return null;
    return {
      used: true,
      telemetryId: state.result.telemetryId || null,
      parserVersion: state.result.parserVersion || null,
      suggestedValue: state.result.draft?.valor ?? null,
      suggestedCategory: state.result.draft?.categoria || null,
      suggestedDescription: state.result.draft?.descricao || null,
      suggestedPayment: state.result.draft?.formaPagamento || null,
      suggestedDate: state.result.draft?.data || null,
      inputMode: state.result?.input?.mode || 'text'
    };
  }

  function afterExpenseSaved(saveResult, smartEntryMeta) {
    const smartText = document.getElementById('smartEntryText');
    if (smartText) smartText.value = '';
    limparSmartEntryPreview();
    if (saveResult?.learning?.learned) carregarRegrasSmart();
    if (smartEntryMeta?.used) carregarMetricasSmart();
  }

  window.GastosSmartEntry = {
    init,
    loadFeature: carregarSmartEntryFeature,
    loadMetrics: carregarMetricasSmart,
    loadRules: carregarRegrasSmart,
    toggleRuleForm: toggleSmartRuleForm,
    clearPreview: limparSmartEntryPreview,
    interpretExternal: interpretarEntradaExterna,
    applyExternalOverrides,
    getSubmissionMeta,
    afterExpenseSaved,
    canAttachReceipt: () =>
      state.appliedToForm &&
      ['qr','receipt','camera'].includes(state.result?.input?.mode)
  };

  // Compatibilidade temporária com handlers inline existentes.
  window.carregarMetricasSmart = carregarMetricasSmart;
  window.carregarRegrasSmart = carregarRegrasSmart;
  window.toggleSmartRuleForm = toggleSmartRuleForm;
})();
