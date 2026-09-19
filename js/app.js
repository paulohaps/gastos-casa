let chartPizzaInstance = null;
let resumoDados = { textoAcerto: "", detalhes: "" };
let mesAtualVigente = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
let idEmEdicao = null;
let usuarioOriginalEdicao = null;
let dadosMesAtual = [];
let dadosMesAnterior = [];
let orcamentosAtuais = [];
let recorrentesAtuais = [];
let membrosAtuais = [];
let smartEntryDraft = null;
let smartEntryResult = null;
const CATEGORIAS_GASTOS = ['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'];


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('Sem PWA por enquanto.'));
    });
}

function inicializarApp() {
    const dataInput = document.getElementById('inputData');
    if (dataInput) dataInput.valueAsDate = new Date();
    carregarMesesDisponiveis();
    carregarMembros();
    configurarSmartEntry();
    carregarSmartEntryFeature();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarApp, { once: true });
} else {
    inicializarApp();
}

function showToast(msg, isError = false) {
    if (window.AppUI) return AppUI.toast(msg, isError ? 'error' : 'success');
}

function setStatusUi(state) {
    if (window.AppUI) return AppUI.setConnectionStatus(state);
}

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const escapeHTML = (str) => str ? str.toString().replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
const extrairMesAnoDeData = (dataStr) => dataStr ? `${dataStr.split('-')[1]}/${dataStr.split('-')[0]}` : null;

async function carregarMesesDisponiveis(mesFoco = null) {
    try {
        const meses = await api.fetchMeses();
        const seletor = document.getElementById('seletorMes');
        seletor.innerHTML = '';
        if(meses.length === 0) meses.push(mesAtualVigente);
        if(!meses.includes(mesAtualVigente)) meses.push(mesAtualVigente);
        meses.sort((a,b) => {
            const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/');
            return new Date(yb, mb-1) - new Date(ya, ma-1);
        });
        meses.forEach(mes => {
            const opt = document.createElement('option');
            opt.value = mes;
            opt.innerText = mes === mesAtualVigente ? `📅 ${mes} (Atual)` : mes;
            seletor.appendChild(opt);
        });
        if (mesFoco && meses.includes(mesFoco)) seletor.value = mesFoco;
        carregarDados(seletor.value);
    } catch (error) { showToast(error?.message || "Erro de conexão", true); }
}

function mudarMes() { carregarDados(document.getElementById('seletorMes').value); }

async function carregarDados(mesParam) {
    const btnIcon = document.querySelector('.fa-arrows-rotate');
    document.body.classList.add('app-loading');
    if (window.AppUI) AppUI.clearModuleErrors();
    try {
        setStatusUi('loading');
        if (btnIcon) btnIcon.classList.add('fa-spin');

        const dados = await api.fetchGastosPorMes(mesParam);
        const mesAnterior = obterMesAnterior(mesParam);
        const resultadosExtras = await Promise.allSettled([
            api.fetchGastosPorMes(mesAnterior),
            api.fetchOrcamentos(mesParam),
            api.fetchRecorrentes()
        ]);

        dadosMesAtual = dados;
        dadosMesAnterior = resultadosExtras[0].status === 'fulfilled' ? resultadosExtras[0].value : [];
        orcamentosAtuais = resultadosExtras[1].status === 'fulfilled' ? resultadosExtras[1].value : [];
        recorrentesAtuais = resultadosExtras[2].status === 'fulfilled' ? resultadosExtras[2].value : [];

        atualizarDashboards(dadosMesAtual);
        renderComparativoMensal();
        renderOrcamentos();
        renderRecorrentes();
        aplicarFiltros();
        renderInsights();
        renderRadarFinanceiro();

        const modulos = [
            { key: 'comparativo', label: 'comparativo', result: resultadosExtras[0] },
            { key: 'orcamento', label: 'orçamento', result: resultadosExtras[1] },
            { key: 'recorrentes', label: 'recorrentes', result: resultadosExtras[2] }
        ];
        const falhas = modulos.filter(item => item.result.status === 'rejected');
        falhas.forEach(item => {
            const motivo = item.result.reason?.message || 'Não foi possível carregar este módulo.';
            console.error('Falha em módulo extra:', item.label, item.result.reason);
            if (window.AppUI) AppUI.setModuleError(item.key, motivo, () => carregarDados(mesParam));
        });
        setStatusUi(falhas.length ? 'error' : 'online');
        if (falhas.length) showToast('Alguns módulos não carregaram. O restante do painel continua disponível.', true);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setStatusUi('error');
        showToast(error?.message || 'Erro ao ler dados.', true);
    } finally {
        document.body.classList.remove('app-loading');
        if (btnIcon) btnIcon.classList.remove('fa-spin');
    }
}

function obterMesAnterior(mes) {
    if (!mes || !mes.includes('/')) return mes;
    const partes = mes.split('/');
    let numeroMes = Number(partes[0]);
    let ano = Number(partes[1]);
    numeroMes -= 1;
    if (numeroMes < 1) {
        numeroMes = 12;
        ano -= 1;
    }
    return String(numeroMes).padStart(2, '0') + '/' + ano;
}

function normalizarTexto(valor) {
    return (valor || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
    const descricao = normalizarTexto(draft.descricao);
    return dadosMesAtual.find(item => {
        const mesmoValor = Math.abs((Number(item.valor) || 0) - Number(draft.valor)) < 0.01;
        const mesmaDescricao = normalizarTexto(item.descricao) === descricao;
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
        const features = await api.fetchFeatures();
        const enabled = features?.smartEntry === true;
        painel.classList.toggle('hidden', !enabled);
        divider.classList.toggle('hidden', !enabled);
    } catch (error) {
        console.warn('Smart Entry indisponível:', error);
        painel.classList.add('hidden');
        divider.classList.add('hidden');
    }
}

function limparSmartEntryPreview() {
    smartEntryDraft = null;
    smartEntryResult = null;
    const preview = document.getElementById('smartEntryPreview');
    if (preview) preview.classList.add('hidden');
}

function preencherFormularioComSmartDraft(draft, { scroll = true } = {}) {
    if (!draft) return false;
    cancelarEdicao();
    const data = document.getElementById('inputData');
    const valor = document.getElementById('inputValor');
    const descricao = document.getElementById('inputDescricao');
    const categoria = document.getElementById('inputCategoria');
    const forma = document.getElementById('inputFormaPagamento');

    if (data && draft.data) data.value = draft.data;
    if (valor) valor.value = draft.valor ?? '';
    if (descricao) descricao.value = draft.descricao || '';
    if (categoria && CATEGORIAS_GASTOS.includes(draft.categoria)) categoria.value = draft.categoria;
    if (forma && ['Dinheiro','Vale'].includes(draft.formaPagamento)) forma.value = draft.formaPagamento;

    if (scroll) {
        const form = document.getElementById('formGasto');
        form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => valor?.focus(), 320);
    }
    return true;
}

function renderSmartEntryPreview(result) {
    const preview = document.getElementById('smartEntryPreview');
    if (!preview) return;

    if (!result || result.intent !== 'expense' || !result.draft) {
        preview.classList.add('hidden');
        const message = result?.warnings?.[0]?.message || 'Não consegui interpretar isso como um novo gasto.';
        showToast(message, true);
        return;
    }

    smartEntryResult = result;
    smartEntryDraft = result.draft;

    document.getElementById('smartEntryPreviewTitle').textContent = smartEntryDraft.descricao || 'Novo gasto';
    document.getElementById('smartEntryValor').textContent = smartEntryDraft.valor ? formatarMoeda(Number(smartEntryDraft.valor)) : 'Revisar';
    document.getElementById('smartEntryCategoria').textContent = smartEntryDraft.categoria || 'Revisar';
    document.getElementById('smartEntryPagamento').textContent = smartEntryDraft.formaPagamento === 'Vale' ? 'Vale' : 'Dinheiro / PIX / Cartão';
    document.getElementById('smartEntryData').textContent = formatarDataIsoBr(smartEntryDraft.data);

    const reviewBadge = document.getElementById('smartEntryReviewBadge');
    reviewBadge.className = 'status-badge ' + (result.needsReview ? 'status-badge--warning' : 'status-badge--success');
    reviewBadge.textContent = result.needsReview ? 'Revisar' : 'Pronto';

    const warnings = document.getElementById('smartEntryWarnings');
    const warningItems = Array.isArray(result.warnings) ? result.warnings : [];
    warnings.innerHTML = '';
    warnings.classList.toggle('hidden', warningItems.length === 0);
    warningItems.forEach(item => {
        const p = document.createElement('p');
        p.innerHTML = '<i class="fa-solid fa-circle-info"></i><span>' + escapeHTML(item.message || '') + '</span>';
        warnings.appendChild(p);
    });

    const duplicate = encontrarDuplicidadeSmart(smartEntryDraft);
    const duplicateBox = document.getElementById('smartEntryDuplicateWarning');
    if (duplicate) {
        duplicateBox.classList.remove('hidden');
        duplicateBox.innerHTML =
            '<i class="fa-solid fa-copy"></i><div><strong>Possível duplicidade</strong><span>' +
            escapeHTML(duplicate.descricao) + ' • ' + formatarMoeda(Number(duplicate.valor) || 0) + ' • ' + escapeHTML(duplicate.data) +
            '</span></div>';
    } else {
        duplicateBox.classList.add('hidden');
        duplicateBox.innerHTML = '';
    }

    const confirm = document.getElementById('btnConfirmarSmart');
    const valid = Number(smartEntryDraft.valor) > 0 &&
        Boolean(smartEntryDraft.descricao) &&
        CATEGORIAS_GASTOS.includes(smartEntryDraft.categoria) &&
        ['Dinheiro','Vale'].includes(smartEntryDraft.formaPagamento) &&
        /^\d{4}-\d{2}-\d{2}$/.test(smartEntryDraft.data || '');
    confirm.disabled = !valid;

    preview.classList.remove('hidden');
}

async function interpretarSmartEntry() {
    const input = document.getElementById('smartEntryText');
    const button = document.getElementById('btnInterpretarSmart');
    const text = input?.value?.trim() || '';
    if (text.length < 3) return showToast('Descreva o gasto antes de interpretar.', true);

    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Interpretando...';
    try {
        const result = await api.parseSmartEntry(text);
        renderSmartEntryPreview(result);
    } catch (error) {
        limparSmartEntryPreview();
        showToast(error?.message || 'Não foi possível interpretar o gasto.', true);
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

function configurarSmartEntry() {
    const panel = document.getElementById('smartEntryPanel');
    if (!panel || panel.dataset.bound === 'true') return;
    panel.dataset.bound = 'true';

    document.getElementById('btnInterpretarSmart')?.addEventListener('click', interpretarSmartEntry);
    document.getElementById('smartEntryText')?.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            interpretarSmartEntry();
        }
    });

    document.getElementById('btnEditarSmart')?.addEventListener('click', () => {
        if (!smartEntryDraft) return;
        preencherFormularioComSmartDraft(smartEntryDraft, { scroll: true });
    });

    document.getElementById('btnConfirmarSmart')?.addEventListener('click', () => {
        if (!smartEntryDraft) return;
        const ok = preencherFormularioComSmartDraft(smartEntryDraft, { scroll: false });
        if (!ok) return;
        const form = document.getElementById('formGasto');
        if (!form?.reportValidity()) {
            form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        form.requestSubmit();
    });
}

function totalizar(dados) {
    return dados.reduce(function(total, item) {
        return total + (Number(item.valor) || 0);
    }, 0);
}

function totaisPorCategoria(dados) {
    const totais = {};
    CATEGORIAS_GASTOS.forEach(function(cat) { totais[cat] = 0; });
    dados.forEach(function(item) {
        const categoria = CATEGORIAS_GASTOS.includes(item.categoria) ? item.categoria : 'Outros';
        totais[categoria] += Number(item.valor) || 0;
    });
    return totais;
}

function dadosAnterioresComparaveis() {
    const mesSelecionado = document.getElementById('seletorMes')?.value;
    if (mesSelecionado !== mesAtualVigente) return dadosMesAnterior;

    const diaLimite = new Date().getDate();
    return dadosMesAnterior.filter(item => {
        const dia = Number(String(item.data || '').split('/')[0]);
        return Number.isFinite(dia) && dia <= diaLimite;
    });
}

function textoPeriodoComparativo() {
    return document.getElementById('seletorMes')?.value === mesAtualVigente
        ? 'mesmo período do mês anterior'
        : 'mês anterior';
}

function renderComparativoMensal() {
    const totalAtual = totalizar(dadosMesAtual);
    const anteriorComparavel = dadosAnterioresComparaveis();
    const totalAnterior = totalizar(anteriorComparavel);
    const valorEl = document.getElementById('cardComparativoValor');
    const textoEl = document.getElementById('cardComparativoTexto');
    const iconeEl = document.getElementById('cardComparativoIcone');

    if (!valorEl || !textoEl || !iconeEl) return;

    let stateClass = 'icon-tile--neutral';
    if (totalAnterior <= 0) {
        valorEl.textContent = 'Sem base';
        textoEl.textContent = 'Não há gastos suficientes no período anterior para comparar.';
    } else {
        const diferenca = totalAtual - totalAnterior;
        const percentual = (diferenca / totalAnterior) * 100;
        valorEl.textContent = (diferenca > 0 ? '+' : '') + percentual.toFixed(1).replace('.', ',') + '%';
        const periodo = textoPeriodoComparativo();

        if (Math.abs(diferenca) < 0.01) {
            textoEl.textContent = 'Mesmo total do ' + periodo + '.';
        } else if (diferenca > 0) {
            textoEl.textContent = formatarMoeda(Math.abs(diferenca)) + ' acima do ' + periodo + '.';
            stateClass = 'icon-tile--danger';
        } else {
            textoEl.textContent = formatarMoeda(Math.abs(diferenca)) + ' abaixo do ' + periodo + '.';
            stateClass = 'icon-tile--success';
        }
    }

    iconeEl.className = 'icon-tile ' + stateClass;
}

function toggleOrcamentoPanel() {
    const painel = document.getElementById('orcamentoPanel');
    if (painel) painel.classList.toggle('hidden');
}

function renderOrcamentos() {
    const gastosCategoria = totaisPorCategoria(dadosMesAtual);
    const mapa = {};
    orcamentosAtuais.forEach(function(item) {
        mapa[item.categoria] = Number(item.valor_limite) || 0;
    });

    document.querySelectorAll('[data-orcamento-categoria]').forEach(function(input) {
        const cat = input.getAttribute('data-orcamento-categoria');
        input.value = mapa[cat] > 0 ? mapa[cat] : '';
    });

    const totalMeta = Object.values(mapa).reduce((total, valor) => total + Number(valor || 0), 0);
    const totalGasto = totalizar(dadosMesAtual);
    const cardValor = document.getElementById('cardOrcamentoValor');
    const resumo = document.getElementById('orcamentoResumo');
    const barra = document.getElementById('orcamentoBarra');
    const detalhes = document.getElementById('orcamentoDetalhes');

    if (!cardValor || !resumo || !barra || !detalhes) return;

    if (totalMeta <= 0) {
        cardValor.textContent = 'Sem meta';
        resumo.textContent = 'Crie limites por categoria para acompanhar o mês.';
        barra.style.width = '0%';
        barra.className = 'progress-bar progress-bar--primary';
    } else {
        const percentual = (totalGasto / totalMeta) * 100;
        cardValor.textContent = formatarMoeda(totalGasto) + ' / ' + formatarMoeda(totalMeta);
        resumo.textContent = percentual.toFixed(0) + '% utilizado • restante ' + formatarMoeda(Math.max(0, totalMeta - totalGasto));
        barra.style.width = Math.min(100, percentual) + '%';
        barra.className = 'progress-bar ' + (percentual > 100 ? 'progress-bar--danger' : percentual >= 80 ? 'progress-bar--warning' : 'progress-bar--primary');
    }

    detalhes.innerHTML = '';
    CATEGORIAS_GASTOS.forEach(function(cat) {
        const limite = mapa[cat] || 0;
        const gasto = gastosCategoria[cat] || 0;
        const percentual = limite > 0 ? (gasto / limite) * 100 : 0;
        const card = document.createElement('div');
        card.className = 'budget-item';
        card.innerHTML =
            '<div class="budget-item__head">' +
                '<span class="budget-item__name">' + escapeHTML(cat === 'Ifood' ? 'iFood' : cat) + '</span>' +
                '<span class="budget-item__percent">' + (limite > 0 ? percentual.toFixed(0) + '%' : 'sem meta') + '</span>' +
            '</div>' +
            '<p class="budget-item__value">' + formatarMoeda(gasto) + '</p>' +
            '<p class="budget-item__meta">' + (limite > 0 ? 'de ' + formatarMoeda(limite) : 'Defina uma meta') + '</p>';
        detalhes.appendChild(card);
    });
}

async function salvarOrcamentos() {
    const botao = document.getElementById('btnSalvarOrcamentos');
    const mes = document.getElementById('seletorMes').value;
    if (!mes) return;

    const original = botao ? botao.innerHTML : '';
    if (botao) {
        botao.disabled = true;
        botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    }

    try {
        const items = [...document.querySelectorAll('[data-orcamento-categoria]')].map(input => ({
            categoria: input.getAttribute('data-orcamento-categoria'),
            valorLimite: Math.max(0, Number(input.value || 0))
        }));

        orcamentosAtuais = await api.salvarOrcamentos(mes, items);
        renderOrcamentos();
        renderInsights();
        showToast('Metas salvas com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar orçamento:', error);
        showToast(error?.message || 'Erro ao salvar orçamento.', true);
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = original;
        }
    }
}

async function carregarMembros() {
    const lista = document.getElementById('listaMembros');
    if (!lista) return;
    try {
        membrosAtuais = await api.fetchMembros();
        renderMembros();
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        lista.innerHTML = '<div class="module-error"><span>' + escapeHTML(error?.message || 'Não foi possível carregar os usuários.') + '</span><button type="button" onclick="carregarMembros()">Tentar novamente</button></div>';
    }
}

function renderMembros() {
    const lista = document.getElementById('listaMembros');
    if (!lista) return;
    if (!membrosAtuais.length) {
        lista.innerHTML = '<div class="recurring-empty"><i class="fa-solid fa-users"></i><span>Nenhum usuário autorizado encontrado.</span></div>';
        return;
    }

    lista.innerHTML = '';
    membrosAtuais.forEach(membro => {
        const item = document.createElement('div');
        item.className = 'member-item';
        item.innerHTML =
            '<span class="member-avatar"><i class="fa-solid fa-user"></i></span>' +
            '<div class="member-item__content">' +
                '<strong>' + escapeHTML(membro.nome || 'Usuário') + '</strong>' +
                '<span>' + escapeHTML(membro.email || 'E-mail não informado') + '</span>' +
            '</div>' +
            '<span class="status-badge ' + (membro.ativo === false ? 'status-badge--warning' : 'status-badge--success') + '">' + (membro.ativo === false ? 'Inativo' : 'Ativo') + '</span>';
        lista.appendChild(item);
    });
}

function toggleMembroForm(forceOpen) {
    const form = document.getElementById('formMembro');
    if (!form) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) setTimeout(() => document.getElementById('membroNome')?.focus(), 0);
    else form.reset();
}

function recorrenteFoiLancado(item) {
    const alvo = normalizarTexto(item.descricao);
    return dadosMesAtual.some(function(gasto) {
        const descricao = normalizarTexto(gasto.descricao);
        return descricao === alvo || descricao.includes(alvo) || alvo.includes(descricao);
    });
}

function renderRecorrentes() {
    const lista = document.getElementById('listaRecorrentes');
    if (!lista) return;

    const ativos = recorrentesAtuais.filter(item => item.ativo !== false);
    if (ativos.length === 0) {
        lista.innerHTML = '<div class="recurring-empty"><i class="fa-solid fa-repeat"></i><span>Nenhum recorrente cadastrado.</span></div>';
        return;
    }

    lista.innerHTML = '';
    ativos.forEach(function(item) {
        const lancado = recorrenteFoiLancado(item);
        const linha = document.createElement('div');
        linha.className = 'recurring-item';
        linha.innerHTML =
            '<div class="recurring-item__content">' +
                '<div class="recurring-item__headline">' +
                    '<p class="recurring-item__title">' + escapeHTML(item.descricao) + '</p>' +
                    '<span class="status-badge ' + (lancado ? 'status-badge--success' : 'status-badge--warning') + '">' + (lancado ? 'Lançado' : 'Pendente') + '</span>' +
                '</div>' +
                '<p class="recurring-item__meta">Dia ' + Number(item.dia_vencimento) + ' • ' + formatarMoeda(Number(item.valor)) + ' • ' + escapeHTML(item.categoria) + '</p>' +
            '</div>' +
            '<div class="recurring-item__actions">' +
                '<button type="button" onclick="usarRecorrente(\'' + escapeHTML(item.id) + '\')" class="table-action" title="Lançar agora" aria-label="Lançar ' + escapeHTML(item.descricao) + ' agora"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>' +
                '<button type="button" onclick="editarRecorrente(\'' + escapeHTML(item.id) + '\')" class="table-action table-action--edit" title="Editar" aria-label="Editar ' + escapeHTML(item.descricao) + '"><i class="fa-solid fa-pen"></i></button>' +
                '<button type="button" onclick="deletarRecorrente(\'' + escapeHTML(item.id) + '\')" class="table-action table-action--danger" title="Excluir" aria-label="Excluir ' + escapeHTML(item.descricao) + '"><i class="fa-solid fa-trash"></i></button>' +
            '</div>';
        lista.appendChild(linha);
    });
}

function toggleRecorrenteForm() {
    const form = document.getElementById('formRecorrente');
    if (!form) return;
    if (form.classList.contains('hidden')) {
        cancelarRecorrente();
        form.classList.remove('hidden');
        document.getElementById('recorrenteDescricao').focus();
    } else {
        form.classList.add('hidden');
    }
}

function cancelarRecorrente() {
    const form = document.getElementById('formRecorrente');
    if (!form) return;
    form.reset();
    document.getElementById('recorrenteId').value = '';
    document.getElementById('recorrenteCategoria').value = 'Contas';
    document.getElementById('recorrenteForma').value = 'Dinheiro';
}

function editarRecorrente(id) {
    const item = recorrentesAtuais.find(function(r) { return r.id === id; });
    if (!item) return;
    const form = document.getElementById('formRecorrente');
    form.classList.remove('hidden');
    document.getElementById('recorrenteId').value = item.id;
    document.getElementById('recorrenteDescricao').value = item.descricao;
    document.getElementById('recorrenteValor').value = Number(item.valor);
    document.getElementById('recorrenteDia').value = Number(item.dia_vencimento);
    document.getElementById('recorrenteCategoria').value = item.categoria || 'Outros';
    document.getElementById('recorrenteForma').value = item.forma_pagamento || 'Dinheiro';
    document.getElementById('recorrenteDescricao').focus();
}

function usarRecorrente(id) {
    const item = recorrentesAtuais.find(function(r) { return r.id === id; });
    if (!item) return;
    cancelarEdicao();
    document.getElementById('inputData').valueAsDate = new Date();
    document.getElementById('inputDescricao').value = item.descricao;
    document.getElementById('inputValor').value = Number(item.valor);
    document.getElementById('inputCategoria').value = item.categoria || 'Outros';
    document.getElementById('inputFormaPagamento').value = item.forma_pagamento || 'Dinheiro';
    document.getElementById('inputValor').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deletarRecorrente(id) {
    const confirmado = window.AppUI ? await AppUI.confirmAction({ title: 'Excluir recorrente', message: 'Este gasto recorrente será removido. Deseja continuar?', confirmLabel: 'Excluir' }) : confirm('Excluir este gasto recorrente?');
    if (!confirmado) return;
    try {
        await api.excluirRecorrente(id);
        recorrentesAtuais = recorrentesAtuais.filter(function(item) { return item.id !== id; });
        renderRecorrentes();
        renderInsights();
        showToast('Recorrente excluído.');
    } catch (error) {
        showToast(error?.message || 'Erro ao excluir recorrente.', true);
    }
}

function renderTabelaFiltrada(dados) {
    const tbody = document.getElementById('tabelaHistorico');
    const emptyState = document.getElementById('emptyState');
    if (!tbody || !emptyState) return;

    tbody.innerHTML = '';
    emptyState.classList.toggle('hidden', dados.length !== 0);

    dados.forEach(gasto => {
        const valor = Number(gasto.valor) || 0;
        const forma = gasto.formaPagamento || 'Dinheiro';
        const tr = document.createElement('tr');

        const tdData = document.createElement('td');
        tdData.className = 'table-date';
        tdData.textContent = gasto.data || '';

        const tdDesc = document.createElement('td');
        tdDesc.className = 'table-description';
        const desc = document.createElement('div');
        desc.textContent = gasto.descricao || '';
        const cat = document.createElement('div');
        cat.className = 'table-category';
        cat.textContent = gasto.categoria || 'Outros';
        tdDesc.append(desc, cat);

        const tdQuem = document.createElement('td');
        const quemWrap = document.createElement('div');
        quemWrap.className = 'table-person-wrap';
        const pessoa = document.createElement('span');
        pessoa.className = 'person-badge ' + (gasto.usuario === 'Paulo Henrique' ? 'person-badge--paulo' : 'person-badge--fernando');
        pessoa.textContent = gasto.usuario === 'Paulo Henrique' ? 'Paulo' : 'Fernando';
        const pagamento = document.createElement('span');
        pagamento.className = 'payment-label' + (forma === 'Vale' ? ' payment-label--vale' : '');
        pagamento.innerHTML = forma === 'Vale'
            ? '<i class="fa-solid fa-ticket"></i> iFood'
            : '<i class="fa-solid fa-money-bill-transfer"></i> Dinheiro';
        quemWrap.append(pessoa, pagamento);
        tdQuem.appendChild(quemWrap);

        const tdValor = document.createElement('td');
        tdValor.className = 'table-value';
        tdValor.textContent = formatarMoeda(valor);

        const tdAcoes = document.createElement('td');
        const acoes = document.createElement('div');
        acoes.className = 'table-actions';

        const criarBotao = (titulo, icon, classe, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = titulo;
            btn.setAttribute('aria-label', titulo + ' ' + (gasto.descricao || 'gasto'));
            btn.className = classe;
            btn.innerHTML = '<i class="' + icon + '"></i>';
            btn.addEventListener('click', onClick);
            return btn;
        };

        acoes.append(
            criarBotao('Duplicar', 'fa-solid fa-copy', 'table-action', () => duplicarGasto(gasto.id)),
            criarBotao('Editar', 'fa-solid fa-pen', 'table-action table-action--edit', () => prepararEdicao(gasto.id, gasto.data, gasto.descricao, valor, gasto.usuario, forma, gasto.categoria || 'Outros')),
            criarBotao('Apagar', 'fa-solid fa-trash-can', 'table-action table-action--danger', event => deletarGasto(gasto.id, event.currentTarget))
        );

        tdAcoes.appendChild(acoes);
        tr.append(tdData, tdDesc, tdQuem, tdValor, tdAcoes);
        tbody.appendChild(tr);
    });
}

function aplicarFiltros() {
    const buscaEl = document.getElementById('filtroBusca');
    const catEl = document.getElementById('filtroCategoria');
    const usuarioEl = document.getElementById('filtroUsuario');
    const formaEl = document.getElementById('filtroForma');
    if (!buscaEl || !catEl || !usuarioEl || !formaEl) return;

    const busca = normalizarTexto(buscaEl.value);
    const categoria = catEl.value;
    const usuario = usuarioEl.value;
    const forma = formaEl.value;

    const filtrados = dadosMesAtual.filter(function(item) {
        const texto = normalizarTexto((item.descricao || '') + ' ' + (item.categoria || ''));
        if (busca && !texto.includes(busca)) return false;
        if (categoria && item.categoria !== categoria) return false;
        if (usuario && item.usuario !== usuario) return false;
        if (forma && (item.formaPagamento || 'Dinheiro') !== forma) return false;
        return true;
    });

    renderTabelaFiltrada(filtrados);

    const contagem = document.getElementById('filtroContagem');
    const totalEl = document.getElementById('filtroTotal');
    if (contagem) contagem.textContent = filtrados.length + (filtrados.length === 1 ? ' lançamento' : ' lançamentos');
    if (totalEl) totalEl.textContent = formatarMoeda(totalizar(filtrados));
}

function duplicarGasto(id) {
    const gasto = dadosMesAtual.find(function(item) { return item.id === id; });
    if (!gasto) return;

    cancelarEdicao();
    document.getElementById('inputData').valueAsDate = new Date();
    document.getElementById('inputDescricao').value = gasto.descricao || '';
    document.getElementById('inputValor').value = Number(gasto.valor) || '';
    document.getElementById('inputFormaPagamento').value = gasto.formaPagamento || 'Dinheiro';
    document.getElementById('inputCategoria').value = gasto.categoria || 'Outros';
    document.getElementById('inputValor').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Gasto copiado para o formulário.');
}

function dataBrParaDate(dataStr) {
    const partes = String(dataStr || '').split('/');
    if (partes.length !== 3) return null;
    const dia = Number(partes[0]);
    const mes = Number(partes[1]);
    const ano = Number(partes[2]);
    const date = new Date(ano, mes - 1, dia);
    return Number.isNaN(date.getTime()) ? null : date;
}

function calcularPossiveisDuplicidades() {
    const alertas = [];
    for (let i = 0; i < dadosMesAtual.length; i++) {
        const a = dadosMesAtual[i];
        for (let j = i + 1; j < dadosMesAtual.length; j++) {
            const b = dadosMesAtual[j];
            const mesmoValor = Math.abs((Number(a.valor) || 0) - (Number(b.valor) || 0)) < 0.01;
            const mesmaDescricao = normalizarTexto(a.descricao) && normalizarTexto(a.descricao) === normalizarTexto(b.descricao);
            const mesmaForma = (a.formaPagamento || 'Dinheiro') === (b.formaPagamento || 'Dinheiro');
            if (!mesmoValor || !mesmaDescricao || !mesmaForma) continue;

            const da = dataBrParaDate(a.data);
            const db = dataBrParaDate(b.data);
            const diffDias = da && db ? Math.abs(da - db) / 86400000 : 99;
            if (diffDias <= 1) {
                alertas.push({
                    nivel: 'warning',
                    titulo: 'Possível gasto duplicado',
                    texto: (a.descricao || 'Lançamento') + ' • ' + formatarMoeda(Number(a.valor) || 0) + ' em datas próximas.'
                });
                if (alertas.length >= 2) return alertas;
            }
        }
    }
    return alertas;
}

function calcularRadarFinanceiro() {
    const mesSelecionado = document.getElementById('seletorMes')?.value || mesAtualVigente;
    const totalAtual = totalizar(dadosMesAtual);
    const agora = new Date();
    const [mesNum, anoNum] = mesSelecionado.split('/').map(Number);
    const diasNoMes = mesNum && anoNum ? new Date(anoNum, mesNum, 0).getDate() : 30;
    const mesAtualSelecionado = mesSelecionado === mesAtualVigente;
    const diaReferencia = mesAtualSelecionado ? Math.max(1, agora.getDate()) : diasNoMes;

    const pendentes = recorrentesAtuais.filter(item => item.ativo !== false && !recorrenteFoiLancado(item));
    const valorPendentes = pendentes.reduce((total, item) => total + (Number(item.valor) || 0), 0);

    let projecao = totalAtual;
    let projecaoTexto = 'Mês encerrado: projeção igual ao total realizado.';
    if (mesAtualSelecionado) {
        const ritmo = diaReferencia >= 3 ? (totalAtual / diaReferencia) * diasNoMes : totalAtual;
        projecao = Math.max(totalAtual + valorPendentes, ritmo);
        projecaoTexto = 'Estimativa pelo ritmo atual' + (valorPendentes > 0 ? ' e pelos recorrentes ainda pendentes.' : '.');
    }

    const gastosCategoria = totaisPorCategoria(dadosMesAtual);
    const metas = {};
    orcamentosAtuais.forEach(item => { metas[item.categoria] = Number(item.valor_limite) || 0; });

    const categoriasRisco = [];
    CATEGORIAS_GASTOS.forEach(cat => {
        const meta = metas[cat] || 0;
        const gasto = gastosCategoria[cat] || 0;
        if (meta <= 0) return;
        const uso = (gasto / meta) * 100;
        if (uso >= 70) categoriasRisco.push({ categoria: cat, uso, gasto, meta });
    });
    categoriasRisco.sort((a,b) => b.uso - a.uso);

    const alertas = [];
    categoriasRisco.forEach(item => {
        const nome = item.categoria === 'Ifood' ? 'iFood' : item.categoria;
        if (item.uso >= 100) {
            alertas.push({ nivel:'danger', titulo:'Orçamento ultrapassado', texto:nome + ' está em ' + item.uso.toFixed(0) + '% da meta.' });
        } else if (item.uso >= 90) {
            alertas.push({ nivel:'danger', titulo:'Orçamento no limite', texto:nome + ' já consumiu ' + item.uso.toFixed(0) + '% da meta.' });
        } else {
            alertas.push({ nivel:'warning', titulo:'Atenção ao orçamento', texto:nome + ' já consumiu ' + item.uso.toFixed(0) + '% da meta.' });
        }
    });

    if (mesAtualSelecionado) {
        const diaHoje = agora.getDate();
        pendentes.forEach(item => {
            const vencimento = Number(item.dia_vencimento) || 1;
            if (vencimento < diaHoje) {
                alertas.push({
                    nivel:'danger',
                    titulo:'Recorrente possivelmente atrasado',
                    texto:(item.descricao || 'Recorrente') + ' venceu no dia ' + vencimento + ' e ainda não foi identificado neste mês.'
                });
            } else if (vencimento - diaHoje <= 3) {
                alertas.push({
                    nivel:'warning',
                    titulo:'Recorrente próximo do vencimento',
                    texto:(item.descricao || 'Recorrente') + ' vence no dia ' + vencimento + '.'
                });
            }
        });
    }

    const anterior = dadosAnterioresComparaveis();
    const catAtual = totaisPorCategoria(dadosMesAtual);
    const catAnterior = totaisPorCategoria(anterior);
    CATEGORIAS_GASTOS.forEach(cat => {
        const atual = catAtual[cat] || 0;
        const prev = catAnterior[cat] || 0;
        if (prev >= 50 && atual - prev >= 50) {
            const alta = ((atual - prev) / prev) * 100;
            if (alta >= 25) {
                alertas.push({
                    nivel:'info',
                    titulo:'Categoria acelerando',
                    texto:(cat === 'Ifood' ? 'iFood' : cat) + ' está ' + alta.toFixed(0) + '% acima do ' + textoPeriodoComparativo() + '.'
                });
            }
        }
    });

    alertas.push(...calcularPossiveisDuplicidades());

    const prioridade = { danger: 3, warning: 2, info: 1 };
    alertas.sort((a,b) => (prioridade[b.nivel] || 0) - (prioridade[a.nivel] || 0));

    return {
        projecao,
        projecaoTexto,
        pendentes,
        valorPendentes,
        categoriasRisco,
        alertas: alertas.slice(0, 8)
    };
}

function renderRadarFinanceiro() {
    const projecaoValor = document.getElementById('projecaoMesValor');
    const projecaoTexto = document.getElementById('projecaoMesTexto');
    const pendentesValor = document.getElementById('recorrentesPendentesValor');
    const pendentesTexto = document.getElementById('recorrentesPendentesTexto');
    const riscoValor = document.getElementById('riscoOrcamentoValor');
    const riscoTexto = document.getElementById('riscoOrcamentoTexto');
    const lista = document.getElementById('alertasFinanceiros');
    const contagem = document.getElementById('alertasFinanceirosContagem');
    const status = document.getElementById('radarStatus');
    if (!projecaoValor || !projecaoTexto || !pendentesValor || !pendentesTexto || !riscoValor || !riscoTexto || !lista || !contagem || !status) return;

    const radar = calcularRadarFinanceiro();
    projecaoValor.textContent = formatarMoeda(radar.projecao);
    projecaoTexto.textContent = radar.projecaoTexto;

    pendentesValor.textContent = String(radar.pendentes.length);
    pendentesTexto.textContent = radar.pendentes.length
        ? formatarMoeda(radar.valorPendentes) + ' ainda previstos.'
        : 'Nenhum recorrente pendente identificado.';

    if (!orcamentosAtuais.length) {
        riscoValor.textContent = 'Sem metas';
        riscoTexto.textContent = 'Defina orçamento por categoria para habilitar o risco automático.';
    } else if (!radar.categoriasRisco.length) {
        riscoValor.textContent = 'Baixo';
        riscoTexto.textContent = 'Nenhuma categoria atingiu 70% da meta.';
    } else {
        const principal = radar.categoriasRisco[0];
        riscoValor.textContent = principal.uso >= 100 ? 'Ultrapassado' : principal.uso >= 90 ? 'Alto' : 'Atenção';
        riscoTexto.textContent = (principal.categoria === 'Ifood' ? 'iFood' : principal.categoria) + ' em ' + principal.uso.toFixed(0) + '% da meta.';
    }

    contagem.textContent = radar.alertas.length + (radar.alertas.length === 1 ? ' alerta' : ' alertas');
    lista.innerHTML = '';

    if (!radar.alertas.length) {
        lista.innerHTML = '<div class="radar-empty"><i class="fa-solid fa-circle-check"></i><span>Nenhum alerta relevante para este mês.</span></div>';
    } else {
        radar.alertas.forEach(alerta => {
            const item = document.createElement('article');
            item.className = 'radar-alert radar-alert--' + alerta.nivel;
            const icon = alerta.nivel === 'danger' ? 'fa-triangle-exclamation' : alerta.nivel === 'warning' ? 'fa-circle-exclamation' : 'fa-chart-column';
            item.innerHTML =
                '<span class="radar-alert__icon"><i class="fa-solid ' + icon + '"></i></span>' +
                '<div><strong>' + escapeHTML(alerta.titulo) + '</strong><p>' + escapeHTML(alerta.texto) + '</p></div>';
            lista.appendChild(item);
        });
    }

    const temCritico = radar.alertas.some(a => a.nivel === 'danger');
    const temAtencao = radar.alertas.some(a => a.nivel === 'warning');
    status.className = 'status-badge ' + (temCritico ? 'status-badge--danger' : temAtencao ? 'status-badge--warning' : 'status-badge--success');
    status.textContent = temCritico ? 'Ação necessária' : temAtencao ? 'Atenção' : 'Estável';

    resumoDados.radar = '\n🔭 *Projeção:* ' + formatarMoeda(radar.projecao) +
        '\n⚠️ *Alertas:* ' + radar.alertas.length + '\n';
}

function renderInsights() {
    const box = document.getElementById('insightsLista');
    if (!box) return;

    const insights = [];
    const anteriorComparavel = dadosAnterioresComparaveis();
    const totalAtual = totalizar(dadosMesAtual);
    const totalAnterior = totalizar(anteriorComparavel);

    if (totalAnterior > 0) {
        const diferenca = totalAtual - totalAnterior;
        const percentual = Math.abs((diferenca / totalAnterior) * 100);
        if (percentual >= 5) {
            insights.push('Gastos estão ' + percentual.toFixed(0) + '% ' + (diferenca > 0 ? 'acima' : 'abaixo') + ' do ' + textoPeriodoComparativo() + '.');
        }
    }

    const categoriasAtual = totaisPorCategoria(dadosMesAtual);
    const categoriasAnterior = totaisPorCategoria(anteriorComparavel);
    let maiorAlta = null;
    CATEGORIAS_GASTOS.forEach(cat => {
        const alta = (categoriasAtual[cat] || 0) - (categoriasAnterior[cat] || 0);
        if (!maiorAlta || alta > maiorAlta.valor) maiorAlta = { categoria: cat, valor: alta };
    });

    if (maiorAlta && maiorAlta.valor > 0 && totalAnterior > 0) {
        insights.push((maiorAlta.categoria === 'Ifood' ? 'iFood' : maiorAlta.categoria) + ' foi a categoria que mais aumentou: +' + formatarMoeda(maiorAlta.valor) + '.');
    }

    const mapaMetas = {};
    orcamentosAtuais.forEach(item => { mapaMetas[item.categoria] = Number(item.valor_limite) || 0; });
    const estouradas = CATEGORIAS_GASTOS.filter(cat => mapaMetas[cat] > 0 && categoriasAtual[cat] > mapaMetas[cat]);
    if (estouradas.length) {
        insights.push(estouradas.length + (estouradas.length === 1 ? ' categoria passou' : ' categorias passaram') + ' do orçamento.');
    }

    const pendentes = recorrentesAtuais.filter(item => item.ativo !== false && !recorrenteFoiLancado(item));
    if (pendentes.length) {
        insights.push(pendentes.length + (pendentes.length === 1 ? ' recorrente ainda não aparece' : ' recorrentes ainda não aparecem') + ' neste mês.');
    }

    if (!insights.length) insights.push('Nenhum alerta relevante encontrado para este mês.');

    box.innerHTML = '';
    insights.slice(0, 3).forEach(texto => {
        const p = document.createElement('p');
        p.className = 'insight-row';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-wand-magic-sparkles';
        const span = document.createElement('span');
        span.textContent = texto;
        p.append(icon, span);
        box.appendChild(p);
    });

    resumoDados.extras = '\n📊 *Comparativo:* ' + (document.getElementById('cardComparativoValor')?.textContent || '—') +
        '\n🎯 *Orçamento:* ' + (document.getElementById('cardOrcamentoValor')?.textContent || 'Sem meta') + '\n';
}


async function deletarGasto(idGasto, btnElement) {
    const confirmado = window.AppUI ? await AppUI.confirmAction({ title: 'Excluir gasto', message: 'Este lançamento será removido do histórico. Deseja continuar?', confirmLabel: 'Excluir' }) : confirm('Tem certeza que deseja apagar este gasto?');
    if (!confirmado) return;
    const mesSelecionado = document.getElementById('seletorMes').value;
    const original = btnElement?.innerHTML || '';
    if (btnElement) {
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnElement.disabled = true;
    }
    try {
        await api.enviarGasto({ action: 'delete', id: idGasto, month: mesSelecionado });
        showToast('Gasto apagado!');
        await carregarDados(mesSelecionado);
    } catch (error) {
        showToast(error?.message || 'Erro ao apagar.', true);
        if (btnElement) {
            btnElement.innerHTML = original || '<i class="fa-solid fa-trash-can"></i>';
            btnElement.disabled = false;
        }
    }
}

function prepararEdicao(id, dataStr, descricao, valor, usuario, forma, categoria) {
    idEmEdicao = id;
    usuarioOriginalEdicao = usuario || null;
    const partesData = String(dataStr || '').split('/');
    if (partesData.length === 3) {
        document.getElementById('inputData').value = partesData[2] + '-' + partesData[1] + '-' + partesData[0];
    }
    document.getElementById('inputDescricao').value = descricao || '';
    document.getElementById('inputValor').value = Number(valor) || '';
    document.getElementById('inputFormaPagamento').value = forma || 'Dinheiro';
    document.getElementById('inputCategoria').value = categoria || 'Outros';

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.classList.add('is-editing');
    btnSubmit.innerHTML = '<span>Salvar Edição</span> <i class="fa-solid fa-pen"></i>';
    document.getElementById('btnCancelarEdicao').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {
    idEmEdicao = null;
    usuarioOriginalEdicao = null;
    const form = document.getElementById('formGasto');
    if (form) form.reset();
    const data = document.getElementById('inputData');
    if (data) data.valueAsDate = new Date();

    const usuario = document.getElementById('inputUsuario');
    if (usuario && window.usuarioLogadoNome) usuario.value = window.usuarioLogadoNome;

    const btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) {
        btnSubmit.classList.remove('is-editing');
        btnSubmit.innerHTML = '<span>Lançar Despesa</span> <i class="fa-solid fa-paper-plane"></i>';
    }
    document.getElementById('btnCancelarEdicao')?.classList.add('hidden');
}

function atualizarDashboards(dados) {
    let pauloDinheiro = 0, pauloVale = 0, gustavoDinheiro = 0, gustavoVale = 0;

    dados.forEach(gasto => {
        const valor = Number(gasto.valor) || 0;
        const forma = gasto.formaPagamento || 'Dinheiro';
        if (gasto.usuario === 'Paulo Henrique') {
            if (forma === 'Vale') pauloVale += valor;
            else pauloDinheiro += valor;
        } else if (gasto.usuario === 'Fernando Gustavo') {
            if (forma === 'Vale') gustavoVale += valor;
            else gustavoDinheiro += valor;
        }
    });

    const totalDinheiro = pauloDinheiro + gustavoDinheiro;
    const totalVale = pauloVale + gustavoVale;
    const totalGeral = totalDinheiro + totalVale;
    const totalPaulo = pauloDinheiro + pauloVale;
    const totalGustavo = gustavoDinheiro + gustavoVale;

    document.getElementById('cardTotal').innerText = formatarMoeda(totalGeral);
    document.getElementById('cardSubtotalGeral').innerText = '(' + formatarMoeda(totalDinheiro) + ' Dinheiro | ' + formatarMoeda(totalVale) + ' Vale)';
    document.getElementById('cardPaulo').innerText = formatarMoeda(totalPaulo);
    document.getElementById('cardSubtotalPaulo').innerText = '(' + formatarMoeda(pauloDinheiro) + ' Dinh. | ' + formatarMoeda(pauloVale) + ' Vale)';
    document.getElementById('cardGustavo').innerText = formatarMoeda(totalGustavo);
    document.getElementById('cardSubtotalGustavo').innerText = '(' + formatarMoeda(gustavoDinheiro) + ' Dinh. | ' + formatarMoeda(gustavoVale) + ' Vale)';

    const saldoPauloDinheiro = pauloDinheiro - (totalDinheiro / 2);
    const saldoPauloVale = pauloVale - (totalVale / 2);
    const boxDinh = document.getElementById('boxAcertoDinheiro');
    const boxVale = document.getElementById('boxAcertoVale');

    let txtResumoDinh = '';
    let txtResumoVale = '';

    if (Math.abs(saldoPauloDinheiro) < 0.05) {
        boxDinh.innerHTML = '<p class="settlement"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: <strong>Tudo quite!</strong></p>';
        txtResumoDinh = 'Dinheiro: Tudo quite!';
    } else if (saldoPauloDinheiro < 0) {
        boxDinh.innerHTML = '<p class="settlement settlement--danger"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: Paulo deve ' + formatarMoeda(Math.abs(saldoPauloDinheiro)) + ' a Fernando</p>';
        txtResumoDinh = 'Dinheiro: Paulo deve transferir ' + formatarMoeda(Math.abs(saldoPauloDinheiro)) + ' para Fernando';
    } else {
        boxDinh.innerHTML = '<p class="settlement settlement--success"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: Fernando deve ' + formatarMoeda(Math.abs(saldoPauloDinheiro)) + ' a Paulo</p>';
        txtResumoDinh = 'Dinheiro: Fernando deve transferir ' + formatarMoeda(Math.abs(saldoPauloDinheiro)) + ' para Paulo';
    }

    if (Math.abs(saldoPauloVale) < 0.05) {
        boxVale.innerHTML = '<p class="settlement"><i class="fa-solid fa-ticket"></i> Vale iFood: <strong>Tudo quite!</strong></p>';
        txtResumoVale = 'Vale iFood: Tudo quite!';
    } else if (saldoPauloVale < 0) {
        boxVale.innerHTML = '<p class="settlement settlement--warning"><i class="fa-solid fa-ticket"></i> Vale iFood: Paulo deve pagar ' + formatarMoeda(Math.abs(saldoPauloVale)) + ' no iFood para Fernando</p>';
        txtResumoVale = 'Vale iFood: Paulo deve pagar ' + formatarMoeda(Math.abs(saldoPauloVale)) + ' de lanche para Fernando';
    } else {
        boxVale.innerHTML = '<p class="settlement settlement--warning"><i class="fa-solid fa-ticket"></i> Vale iFood: Fernando deve pagar ' + formatarMoeda(Math.abs(saldoPauloVale)) + ' no iFood para Paulo</p>';
        txtResumoVale = 'Vale iFood: Fernando deve pagar ' + formatarMoeda(Math.abs(saldoPauloVale)) + ' de lanche para Paulo';
    }

    resumoDados.textoAcerto = '👉 ' + txtResumoDinh + '\n👉 ' + txtResumoVale;
    resumoDados.detalhes = '\n💰 *Total:* ' + formatarMoeda(totalGeral) + '\n👤 *Paulo:* ' + formatarMoeda(totalPaulo) + '\n🧑‍🚀 *Fernando:* ' + formatarMoeda(totalGustavo) + '\n';

    renderizarGraficoPizza(totalPaulo, totalGustavo);
}

function gerarResumo() {
    const mesStr = document.getElementById('seletorMes').value;
    const texto = '🧾 *Resumo de Gastos - ' + mesStr + '*' + resumoDados.detalhes +
        (resumoDados.extras || '') + (resumoDados.radar || '') + '\n⚖️ *Acerto de Contas:*\n' + resumoDados.textoAcerto;
    navigator.clipboard.writeText(texto)
        .then(() => alert('Resumo copiado!\n\n' + texto))
        .catch(() => alert(texto));
}

function renderizarGraficoPizza(v1, v2, tentativa = 0) {
    const canvas = document.getElementById('chartDivisao');
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
        if (tentativa < 5) setTimeout(() => renderizarGraficoPizza(v1, v2, tentativa + 1), 600);
        return;
    }
    const ctx = canvas.getContext('2d');
    if (chartPizzaInstance) chartPizzaInstance.destroy();
    chartPizzaInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Paulo Henrique', 'Fernando Gustavo'],
            datasets: [{ data: [v1, v2], backgroundColor: ['#4f46e5', '#10b981'], borderWidth: 0 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

const formGasto = document.getElementById('formGasto');
if (formGasto) {
    formGasto.addEventListener('submit', async event => {
        event.preventDefault();

        const valorInput = Number(document.getElementById('inputValor').value);
        const dataInputStr = document.getElementById('inputData').value;
        if (!Number.isFinite(valorInput) || valorInput <= 0) {
            return showToast('Valor inválido!', true);
        }

        const btn = document.getElementById('btnSubmit');
        const originalText = btn.innerHTML;
        const estavaEditando = Boolean(idEmEdicao);

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
        btn.disabled = true;

        const payload = {
            action: estavaEditando ? 'update' : 'add',
            id: idEmEdicao,
            month: document.getElementById('seletorMes').value,
            dataGasto: dataInputStr,
            formaPagamento: document.getElementById('inputFormaPagamento').value,
            usuario: estavaEditando && usuarioOriginalEdicao ? usuarioOriginalEdicao : (window.usuarioLogadoNome || document.getElementById('inputUsuario').value),
            valor: valorInput,
            descricao: document.getElementById('inputDescricao').value.trim(),
            categoria: document.getElementById('inputCategoria').value
        };

        try {
            await api.enviarGasto(payload);
            cancelarEdicao();
            showToast(estavaEditando ? 'Despesa atualizada!' : 'Despesa lançada!');
            if (!estavaEditando) {
                const smartText = document.getElementById('smartEntryText');
                if (smartText) smartText.value = '';
                limparSmartEntryPreview();
            }
            const mesDoGasto = extrairMesAnoDeData(dataInputStr);
            await carregarMesesDisponiveis(mesDoGasto);
        } catch (error) {
            showToast(error?.message || 'Erro ao salvar gasto.', true);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

const formMembro = document.getElementById('formMembro');
if (formMembro) {
    formMembro.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = {
            name: document.getElementById('membroNome').value.trim(),
            email: document.getElementById('membroEmail').value.trim(),
            password: document.getElementById('membroSenha').value
        };
        const submit = formMembro.querySelector('button[type="submit"]');
        const original = submit.innerHTML;
        submit.disabled = true;
        submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';
        try {
            await api.adicionarMembro(payload);
            formMembro.reset();
            formMembro.classList.add('hidden');
            await carregarMembros();
            showToast('Usuário cadastrado e autorizado!');
        } catch (error) {
            console.error('Erro ao cadastrar usuário:', error);
            showToast(error?.message || 'Erro ao cadastrar usuário.', true);
        } finally {
            submit.disabled = false;
            submit.innerHTML = original;
        }
    });
}

const formRecorrente = document.getElementById('formRecorrente');
if (formRecorrente) {
    formRecorrente.addEventListener('submit', async function(event) {
        event.preventDefault();
        const payload = {
            id: document.getElementById('recorrenteId').value || null,
            descricao: document.getElementById('recorrenteDescricao').value.trim(),
            valor: Number(document.getElementById('recorrenteValor').value),
            diaVencimento: Number(document.getElementById('recorrenteDia').value),
            categoria: document.getElementById('recorrenteCategoria').value,
            formaPagamento: document.getElementById('recorrenteForma').value,
            ativo: true
        };

        if (!payload.descricao || payload.valor <= 0 || payload.diaVencimento < 1 || payload.diaVencimento > 31) {
            return showToast('Revise os dados do recorrente.', true);
        }

        const submit = formRecorrente.querySelector('button[type="submit"]');
        const original = submit.innerHTML;
        submit.disabled = true;
        submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

        try {
            await api.salvarRecorrente(payload);
            recorrentesAtuais = await api.fetchRecorrentes();
            cancelarRecorrente();
            formRecorrente.classList.add('hidden');
            renderRecorrentes();
            renderInsights();
            showToast('Recorrente salvo!');
        } catch (error) {
            showToast(error?.message || 'Erro ao salvar recorrente.', true);
        } finally {
            submit.disabled = false;
            submit.innerHTML = original;
        }
    });
}
