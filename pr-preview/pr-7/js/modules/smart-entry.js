(function () {
  'use strict';

  const state = {
    draft: null,
    result: null,
    appliedToForm: false,
    rules: [],
    metrics: null,
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
    bindRuleForm();
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
            ? '<i class="fa-solid fa-stop"></i><span>Parar</span>'
            : '<i class="fa-solid fa-microphone"></i><span>Falar</span>';
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

function formatarPercentualSmart(value) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(1).replace('.', ',') + '%' : '—';
}

function formatarTempoSmart(seconds) {
    if (!Number.isFinite(Number(seconds))) return '—';
    const total = Math.max(0, Math.round(Number(seconds)));
    if (total < 60) return total + 's';
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return sec ? min + 'm ' + sec + 's' : min + 'm';
}

async function carregarMetricasSmart() {
    const container = document.getElementById('smartMetricsCorrecoes');
    if (!container) return;
    const days = Number(document.getElementById('smartMetricsDays')?.value || 30);
    try {
        state.metrics = await ctx.api.fetchSmartMetrics(days);
        renderMetricasSmart();
    } catch (error) {
        console.error('Erro ao carregar métricas do Smart Entry:', error);
        container.innerHTML = '<div class="module-error"><span>' + ctx.escapeHTML(error?.message || 'Não foi possível carregar a qualidade do Smart Entry.') + '</span><button type="button" onclick="carregarMetricasSmart()">Tentar novamente</button></div>';
        const impact = document.getElementById('smartMetricsLearningImpact');
        if (impact) impact.innerHTML = '';
    }
}

function renderMetricasSmart() {
    const metrics = state.metrics;
    if (!metrics) return;

    const interpretacoes = document.getElementById('smartMetricInterpretacoes');
    const interpretacoesMeta = document.getElementById('smartMetricInterpretacoesMeta');
    const confirmados = document.getElementById('smartMetricConfirmados');
    const confirmadosMeta = document.getElementById('smartMetricConfirmadosMeta');
    const semCorrecao = document.getElementById('smartMetricSemCorrecao');
    const semCorrecaoMeta = document.getElementById('smartMetricSemCorrecaoMeta');
    const tempo = document.getElementById('smartMetricTempo');
    const correcoes = document.getElementById('smartMetricsCorrecoes');
    const impact = document.getElementById('smartMetricsLearningImpact');

    if (interpretacoes) interpretacoes.textContent = String(metrics.interpretations || 0);
    if (interpretacoesMeta) {
        const unsupported = Number(metrics.unsupported || 0);
        interpretacoesMeta.textContent = unsupported
            ? unsupported + (unsupported === 1 ? ' comando/consulta rejeitado' : ' comandos/consultas rejeitados')
            : 'Somente tentativas válidas ou protegidas';
    }

    if (confirmados) confirmados.textContent = String(metrics.confirmed || 0);
    if (confirmadosMeta) {
        confirmadosMeta.textContent = Number(metrics.expenseInterpretations || 0)
            ? formatarPercentualSmart(metrics.confirmationRate) + ' das interpretações de gasto'
            : 'Ainda sem amostra';
    }

    if (semCorrecao) {
        semCorrecao.textContent = Number(metrics.confirmed || 0)
            ? formatarPercentualSmart(metrics.noCorrectionRate)
            : '—';
    }
    if (semCorrecaoMeta) {
        semCorrecaoMeta.textContent = Number(metrics.confirmed || 0)
            ? String(metrics.noCorrection || 0) + ' de ' + String(metrics.confirmed || 0) + ' confirmados'
            : 'Ainda sem lançamentos confirmados';
    }

    if (tempo) tempo.textContent = formatarTempoSmart(metrics.avgConfirmSeconds);

    if (correcoes) {
        const labels = {
            value: 'Valor',
            description: 'Descrição',
            category: 'Categoria',
            payment: 'Pagamento',
            date: 'Data'
        };
        correcoes.innerHTML = '';
        Object.entries(labels).forEach(([key, label]) => {
            const item = metrics.corrections?.[key] || { count: 0, rate: null };
            const row = document.createElement('div');
            row.className = 'smart-correction-row';
            const rate = Number.isFinite(Number(item.rate)) ? Number(item.rate) : 0;
            row.innerHTML =
                '<div class="smart-correction-row__head"><span>' + label + '</span><strong>' +
                (metrics.confirmed ? formatarPercentualSmart(item.rate) : '—') +
                '</strong></div>' +
                '<div class="smart-correction-row__track"><span style="width:' + Math.min(100, Math.max(0, rate)) + '%"></span></div>' +
                '<small>' + String(item.count || 0) + ' correções</small>';
            correcoes.appendChild(row);
        });
    }

    if (impact) {
        const li = metrics.learningImpact || {};
        const learnedN = Number(li.learnedConfirmed || 0);
        const baselineN = Number(li.baselineConfirmed || 0);
        impact.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'smart-learning-impact__card';

        if (learnedN === 0) {
            card.innerHTML =
                '<span class="smart-learning-impact__icon"><i class="fa-solid fa-seedling"></i></span>' +
                '<div><strong>Aguardando uso do aprendizado</strong><p>Quando regras aprendidas participarem de lançamentos confirmados, o app compara a taxa de correção com o restante do parser.</p></div>';
        } else if (learnedN < 3 || baselineN < 3) {
            card.innerHTML =
                '<span class="smart-learning-impact__icon"><i class="fa-solid fa-flask"></i></span>' +
                '<div><strong>Amostra inicial</strong><p>' +
                learnedN + ' confirmados com aprendizado e ' + baselineN + ' sem aprendizado. ' +
                'A comparação aparece como evidência somente após pelo menos 3 casos em cada grupo.</p></div>';
        } else {
            const improvement = Number(li.improvementPp);
            const learnedRate = formatarPercentualSmart(li.learnedCategoryCorrectionRate);
            const baselineRate = formatarPercentualSmart(li.baselineCategoryCorrectionRate);
            const signal = Number.isFinite(improvement)
                ? (improvement > 0 ? improvement.toFixed(1).replace('.', ',') + ' p.p. menos correções' :
                   improvement < 0 ? Math.abs(improvement).toFixed(1).replace('.', ',') + ' p.p. mais correções' :
                   'mesma taxa de correção')
                : 'comparação indisponível';
            card.innerHTML =
                '<span class="smart-learning-impact__icon"><i class="fa-solid fa-brain"></i></span>' +
                '<div><strong>' + ctx.escapeHTML(signal) + '</strong><p>Categoria: ' +
                learnedRate + ' com aprendizado vs ' + baselineRate + ' sem aprendizado. ' +
                learnedN + ' vs ' + baselineN + ' confirmações.</p></div>';
        }

        impact.appendChild(card);
        const meta = document.createElement('p');
        meta.className = 'smart-learning-impact__meta';
        meta.textContent = (metrics.unconfirmed || 0) + ' interpretações ainda sem confirmação • ' +
            (metrics.learningRecorded || 0) + ' evidências de aprendizado registradas';
        impact.appendChild(meta);
    }
}

async function carregarRegrasSmart() {
    const lista = document.getElementById('listaSmartRules');
    if (!lista) return;
    try {
        state.rules = await ctx.api.fetchSmartRules();
        renderRegrasSmart();
    } catch (error) {
        console.error('Erro ao carregar regras inteligentes:', error);
        lista.innerHTML = '<div class="module-error"><span>' + ctx.escapeHTML(error?.message || 'Não foi possível carregar o aprendizado.') + '</span><button type="button" onclick="carregarRegrasSmart()">Tentar novamente</button></div>';
    }
}

function agruparRegrasSmart() {
    const grupos = new Map();
    state.rules.forEach(rule => {
        const termo = String(rule.termo_normalizado || '').trim();
        if (!termo) return;
        if (!grupos.has(termo)) grupos.set(termo, []);
        grupos.get(termo).push(rule);
    });

    return [...grupos.entries()].map(([termo, rows]) => {
        const ativos = rows.filter(row => row.ativo !== false);
        const manual = ativos.find(row => row.manual === true) || null;
        const ranked = [...ativos].sort((a,b) => (Number(b.confirmacoes) || 0) - (Number(a.confirmacoes) || 0));
        const principal = manual || ranked[0] || rows[0];
        const totalConfirmacoes = rows.reduce((sum, row) => sum + (Number(row.confirmacoes) || 0), 0);
        const concorrentes = rows
            .filter(row => row.categoria !== principal?.categoria)
            .reduce((sum, row) => sum + (Number(row.confirmacoes) || 0), 0);
        return { termo, rows, principal, manual, totalConfirmacoes, concorrentes };
    }).sort((a,b) => {
        if (Boolean(b.manual) !== Boolean(a.manual)) return Number(Boolean(b.manual)) - Number(Boolean(a.manual));
        return b.totalConfirmacoes - a.totalConfirmacoes || a.termo.localeCompare(b.termo);
    });
}

function renderRegrasSmart() {
    const lista = document.getElementById('listaSmartRules');
    if (!lista) return;
    const grupos = agruparRegrasSmart();

    if (!grupos.length) {
        lista.innerHTML = '<div class="recurring-empty"><i class="fa-solid fa-brain"></i><span>Nenhuma regra aprendida ainda. Confirme gastos pelo lançamento rápido ou crie uma regra manual.</span></div>';
        return;
    }

    lista.innerHTML = '';
    grupos.forEach(grupo => {
        const item = document.createElement('article');
        item.className = 'smart-rule-item';

        const info = document.createElement('div');
        info.className = 'smart-rule-item__info';

        const titleRow = document.createElement('div');
        titleRow.className = 'smart-rule-item__title';
        const title = document.createElement('strong');
        title.textContent = grupo.termo;
        const badge = document.createElement('span');
        badge.className = 'status-badge ' + (grupo.manual ? 'status-badge--success' : grupo.concorrentes > 0 ? 'status-badge--warning' : 'status-badge--success');
        badge.textContent = grupo.manual ? 'Manual' : grupo.concorrentes > 0 ? 'Revisar' : 'Aprendido';
        titleRow.append(title, badge);

        const meta = document.createElement('span');
        if (grupo.manual) {
            meta.textContent = 'Regra explícita • prioridade máxima';
        } else {
            const qtd = grupo.totalConfirmacoes;
            meta.textContent = qtd + (qtd === 1 ? ' confirmação' : ' confirmações') +
                (grupo.concorrentes > 0 ? ' • ' + grupo.concorrentes + ' em categoria concorrente' : '');
        }
        info.append(titleRow, meta);

        const controls = document.createElement('div');
        controls.className = 'smart-rule-item__controls';

        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Categoria para ' + grupo.termo);
        ctx.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat === 'Ifood' ? 'iFood' : cat;
            option.selected = cat === grupo.principal?.categoria;
            select.appendChild(option);
        });

        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'table-action';
        save.title = 'Fixar categoria';
        save.setAttribute('aria-label', 'Fixar categoria para ' + grupo.termo);
        save.innerHTML = '<i class="fa-solid fa-check"></i>';
        save.onclick = () => salvarRegraSmartInline(grupo.termo, select.value, save);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'table-action table-action--danger';
        remove.title = 'Excluir aprendizado';
        remove.setAttribute('aria-label', 'Excluir aprendizado de ' + grupo.termo);
        remove.innerHTML = '<i class="fa-solid fa-trash"></i>';
        remove.onclick = () => excluirAprendizadoSmart(grupo.termo);

        controls.append(select, save, remove);
        item.append(info, controls);
        lista.appendChild(item);
    });
}

async function salvarRegraSmartInline(termo, categoria, button) {
    const original = button?.innerHTML || '';
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    try {
        await ctx.api.salvarRegraSmart(termo, categoria);
        await carregarRegrasSmart();
        ctx.showToast('Regra inteligente fixada.');
    } catch (error) {
        ctx.showToast(error?.message || 'Não foi possível salvar a regra.', true);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original || '<i class="fa-solid fa-check"></i>';
        }
    }
}

async function excluirAprendizadoSmart(termo) {
    const confirmado = window.AppUI
        ? await AppUI.confirmAction({
            title: 'Excluir aprendizado',
            message: 'Todas as evidências e regras para "' + termo + '" serão removidas. Deseja continuar?',
            confirmLabel: 'Excluir'
        })
        : confirm('Excluir aprendizado de "' + termo + '"?');
    if (!confirmado) return;

    try {
        await ctx.api.excluirTermoSmart(termo);
        await carregarRegrasSmart();
        ctx.showToast('Aprendizado removido.');
    } catch (error) {
        ctx.showToast(error?.message || 'Não foi possível excluir o aprendizado.', true);
    }
}

function toggleSmartRuleForm(forceOpen, termo = '', categoria = 'Outros') {
    const form = document.getElementById('formSmartRule');
    if (!form) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) {
        document.getElementById('smartRuleTermo').value = termo || '';
        document.getElementById('smartRuleCategoria').value = ctx.categories.includes(categoria) ? categoria : 'Outros';
        setTimeout(() => document.getElementById('smartRuleTermo')?.focus(), 0);
    } else {
        form.reset();
    }
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

  function bindRuleForm() {
    const formSmartRule = document.getElementById('formSmartRule');
    if (!formSmartRule || formSmartRule.dataset.bound === 'true') return;
    formSmartRule.dataset.bound = 'true';
    formSmartRule.addEventListener('submit', async event => {
      event.preventDefault();
      const termo = document.getElementById('smartRuleTermo').value.trim();
      const categoria = document.getElementById('smartRuleCategoria').value;
      if (termo.length < 2) return ctx.showToast('Informe um termo válido.', true);

      const submit = formSmartRule.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
      try {
        await ctx.api.salvarRegraSmart(termo, categoria);
        toggleSmartRuleForm(false);
        await carregarRegrasSmart();
        ctx.showToast('Regra manual salva.');
      } catch (error) {
        ctx.showToast(error?.message || 'Erro ao salvar regra.', true);
      } finally {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  }

  window.GastosSmartEntry = {
    init,
    loadFeature: carregarSmartEntryFeature,
    loadMetrics: carregarMetricasSmart,
    loadRules: carregarRegrasSmart,
    toggleRuleForm: toggleSmartRuleForm,
    clearPreview: limparSmartEntryPreview,
    interpretExternal: interpretarEntradaExterna,
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
