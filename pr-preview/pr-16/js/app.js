let mesAtualVigente = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
let dadosMesAtual = [];
let dadosMesAnterior = [];
let behaviorResult = {
    version: 'behavior-v1',
    signals: [],
    summary: { total: 0, byType: {}, highestSeverity: null },
    context: { currentMonth: mesAtualVigente, baselineMonths: [], periodDay: new Date().getDate() }
};

window.GastosBehavior = Object.freeze({
    getResult: () => behaviorResult,
    getSignals: () => behaviorResult.signals || []
});
const {
    DEFAULT_CATEGORIES: CATEGORIAS_GASTOS,
    formatCurrency: formatarMoeda,
    escapeHTML,
    extractMonthFromIso: extrairMesAnoDeData,
    previousMonth: obterMesAnterior,
    normalizeText: normalizarTexto,
    totalize: totalizar,
    totalsByCategory
} = window.GastosUtils;

const totaisPorCategoria = dados => totalsByCategory(dados, CATEGORIAS_GASTOS);


if (false && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('Sem PWA por enquanto.'));
    });
}

function inicializarApp() {
    const dataInput = document.getElementById('inputData');
    if (dataInput) dataInput.valueAsDate = new Date();
    carregarMesesDisponiveis();
    window.GastosSettings?.init({ api, ui: window.AppUI, showToast, categories: CATEGORIAS_GASTOS, getAccountName: () => window.usuarioLogadoNome || '', getPaymentMethods: () => [...document.getElementById('inputFormaPagamento').options].map(option => option.value).filter(Boolean) });
    window.GastosExperience?.init({
        api,
        getCurrentExpenses: () => dadosMesAtual,
        getBehaviorResult: () => behaviorResult,
        getSelectedMonth: () => document.getElementById('seletorMes')?.value || mesAtualVigente,
        syncHouseFilters: filters => {
            const mapping = { filtroBusca: filters.query, filtroCategoria: filters.category, filtroUsuario: filters.person, filtroForma: filters.method };
            for (const [id, value] of Object.entries(mapping)) { const field = document.getElementById(id); if (field) field.value = value; }
            window.GastosExpenses?.applyFilters();
        },
        getOwner: () => window.usuarioLogadoNome || '',
        getStatus: () => monthlyState.status,
        getDashboardSources: () => {
            const data = monthlyState.data;
            if (!data) return { history: [], budgets: null, payments: null, radarAvailable: false };
            const { resultadosExtras: results, mesAnterior, mesAnterior2, mesAnterior3 } = data;
            return {
                history: [[mesAnterior, 0], [mesAnterior2, 4], [mesAnterior3, 5]].map(([month, index]) => ({ month, expenses: results[index].status === 'fulfilled' ? results[index].value : null })),
                budgets: results[1].status === 'fulfilled' ? results[1].value : null,
                payments: results[3].status === 'fulfilled' ? results[3].value : null,
                radarAvailable: [0, 1, 2, 4, 5].every(index => results[index].status === 'fulfilled')
            };
        },
        showToast
    });
    window.GastosAssistant?.init({ api, getSelectedMonth: () => document.getElementById('seletorMes')?.value || mesAtualVigente });
    window.GastosExpenses?.init({
        api,
        ui: window.AppUI,
        getCurrentExpenses: () => dadosMesAtual,
        normalizeText: normalizarTexto,
        formatCurrency: formatarMoeda,
        totalize: totalizar,
        showToast,
        reloadMonth: carregarDados,
        reloadMonths: carregarMesesDisponiveis,
        extractMonthFromIso: extrairMesAnoDeData
    });
    window.GastosInsights?.init({
        getBehaviorResult: () => behaviorResult,
        formatCurrency: formatarMoeda
    });
    window.GastosDashboard?.init({
        getCurrentExpenses: () => dadosMesAtual,
        getPreviousExpenses: () => dadosMesAnterior,
        isPreviousAvailable: () => monthlyState.data?.resultadosExtras[0]?.status === 'fulfilled',
        getSelectedMonth: () => document.getElementById('seletorMes')?.value || mesAtualVigente,
        getCurrentMonth: () => mesAtualVigente,
        categories: CATEGORIAS_GASTOS,
        totalize: totalizar,
        totalsByCategory: totaisPorCategoria,
        formatCurrency: formatarMoeda,
        getBudgets: () => window.GastosBudgets?.getItems() || [],
        getRecurring: () => window.GastosRecurring?.getItems() || [],
        recurringWasPosted: item => window.GastosRecurring?.wasPosted(item) || false,
        getBehaviorResult: () => behaviorResult
    });
    window.GastosSettlements?.init({
        api,
        getSelectedMonth: () => document.getElementById('seletorMes')?.value || mesAtualVigente,
        formatCurrency: formatarMoeda,
        showToast,
        reloadMonth: carregarDados
    });
    window.GastosWallets?.init({ api, ui: window.AppUI, formatCurrency: formatarMoeda, showToast });
    window.GastosBudgets?.init({
        api,
        categories: CATEGORIAS_GASTOS,
        isAvailable: () => monthlyState.data?.resultadosExtras[1]?.status === 'fulfilled',
        getCurrentExpenses: () => dadosMesAtual,
        totalsByCategory: totaisPorCategoria,
        totalize: totalizar,
        formatCurrency: formatarMoeda,
        escapeHTML,
        showToast,
        renderInsights: () => window.GastosDashboard?.renderInsights(),
        renderRadar: () => window.GastosRadar?.render()
    });
    window.GastosRecurring?.init({
        api,
        ui: window.AppUI,
        getCurrentExpenses: () => dadosMesAtual,
        normalizeText: normalizarTexto,
        formatCurrency: formatarMoeda,
        escapeHTML,
        showToast,
        cancelExpenseEdit: () => window.GastosExpenses?.cancelEdit(),
        renderInsights: () => window.GastosDashboard?.renderInsights(),
        renderRadar: () => window.GastosRadar?.render()
    });
    window.GastosSmartEntry?.init({
        api,
        ui: window.AppUI,
        categories: CATEGORIAS_GASTOS,
        getCurrentExpenses: () => dadosMesAtual,
        cancelEdit: () => window.GastosExpenses?.cancelEdit(),
        formatCurrency: formatarMoeda,
        normalizeText: normalizarTexto,
        escapeHTML,
        showToast
    });
    window.GastosSmartEntry?.loadFeature();
    window.GastosReceiptImport?.init({
        api,
        formatCurrency: formatarMoeda,
        escapeHTML,
        showToast
    });
    window.GastosRadar?.init({
        isAvailable: () => [0, 1, 2, 4, 5].every(index => monthlyState.data?.resultadosExtras[index]?.status === 'fulfilled'),
        getCurrentExpenses: () => dadosMesAtual,
        getRecurring: () => window.GastosRecurring?.getItems() || [],
        getBudgets: () => window.GastosBudgets?.getItems() || [],
        categories: CATEGORIAS_GASTOS,
        getCurrentMonth: () => mesAtualVigente,
        normalizeText: normalizarTexto,
        formatCurrency: formatarMoeda,
        escapeHTML,
        totalize: totalizar,
        totalsByCategory: totaisPorCategoria,
        recurringWasPosted: item => window.GastosRecurring?.wasPosted(item) || false,
        getComparablePrevious: () => window.GastosDashboard?.getComparablePrevious() || [],
        getComparisonLabel: () => window.GastosDashboard?.getComparisonLabel() || 'mês anterior',
        setSummaryRadar: value => window.GastosDashboard?.setRadarSummary(value)
    });
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
        return await carregarDados(seletor.value);
    } catch (error) {
        renderMonthlyState({ status: 'error', key: mesFoco || mesAtualVigente, data: null, error, retry: () => carregarMesesDisponiveis(mesFoco) });
    }
}

function mudarMes() { carregarDados(document.getElementById('seletorMes').value); }

let monthlyState = { status: 'loading', key: mesAtualVigente, data: null };
const monthLoader = window.GastosLatestLoader.create({
    async read(mesParam, signal) {
        const options = { signal };
        const dados = await api.fetchGastosPorMes(mesParam, options);
        signal.throwIfAborted();
        const mesAnterior = obterMesAnterior(mesParam);
        const mesAnterior2 = obterMesAnterior(mesAnterior);
        const mesAnterior3 = obterMesAnterior(mesAnterior2);
        const resultadosExtras = await Promise.allSettled([
            api.fetchGastosPorMes(mesAnterior, options),
            api.fetchOrcamentos(mesParam, options),
            api.fetchRecorrentes(options),
            api.fetchAcertos(mesParam, options),
            api.fetchGastosPorMes(mesAnterior2, options),
            api.fetchGastosPorMes(mesAnterior3, options)
        ]);
        signal.throwIfAborted();
        return { dados, resultadosExtras, mesAnterior, mesAnterior2, mesAnterior3 };
    },
    isEmpty: data => data.dados.length === 0,
    publish: renderMonthlyState
});

function renderMonthlyState(state) {
    monthlyState = state;
    window.AppUI.setMonthState(state, state.retry || (() => carregarDados(state.key)));
    if (state.status === 'loading' || state.status === 'error') {
        window.GastosExperience?.invalidate();
        dadosMesAtual = [];
        dadosMesAnterior = [];
        behaviorResult = { ...behaviorResult, signals: [], summary: { total: 0, byType: {}, highestSeverity: null } };
        setStatusUi(state.status === 'loading' ? 'loading' : 'error');
        return;
    }
    const { dados, resultadosExtras, mesAnterior, mesAnterior2, mesAnterior3 } = state.data;
    const mesParam = state.key;
    dadosMesAtual = dados;
    dadosMesAnterior = resultadosExtras[0].status === 'fulfilled' ? resultadosExtras[0].value : [];
    window.GastosBudgets?.setItems(resultadosExtras[1].status === 'fulfilled' ? resultadosExtras[1].value : []);
    window.GastosRecurring?.setItems(resultadosExtras[2].status === 'fulfilled' ? resultadosExtras[2].value : null);
    window.GastosSettlements?.setItems(resultadosExtras[3].status === 'fulfilled' ? resultadosExtras[3].value : null);

    const historicoBehavior = [
        resultadosExtras[0].status === 'fulfilled' ? { month: mesAnterior, expenses: resultadosExtras[0].value } : null,
        resultadosExtras[4].status === 'fulfilled' ? { month: mesAnterior2, expenses: resultadosExtras[4].value } : null,
        resultadosExtras[5].status === 'fulfilled' ? { month: mesAnterior3, expenses: resultadosExtras[5].value } : null
    ].filter(Boolean);

    behaviorResult = window.GastosBehaviorEngine?.analyze({
        currentExpenses: dadosMesAtual,
        historyMonths: historicoBehavior,
        recurring: window.GastosRecurring?.getItems() || [],
        currentMonth: mesParam,
        currentDay: new Date().getDate(),
        isCurrentMonth: mesParam === mesAtualVigente
    }) || behaviorResult;

    window.GastosExperience?.renderHome();
    window.GastosDashboard?.updateMain(dadosMesAtual);
    window.GastosDashboard?.renderComparison();
    window.GastosBudgets?.render();
    window.GastosRecurring?.render();
    window.GastosExpenses?.applyFilters();
    window.GastosDashboard?.renderInsights();
    window.GastosRadar?.render();

    const modulos = [
        { key: 'comparativo', label: 'comparativo', result: resultadosExtras[0] },
        { key: 'orcamento', label: 'orçamento', result: resultadosExtras[1] },
        { key: 'recorrentes', label: 'recorrentes', result: resultadosExtras[2] },
        { key: 'acertos', label: 'acertos', result: resultadosExtras[3] }
    ];
    const falhas = modulos.filter(item => item.result.status === 'rejected');
    falhas.forEach(item => {
        const motivo = item.result.reason?.message || 'Não foi possível carregar este módulo.';
        console.error('Falha em módulo extra:', item.label, item.result.reason);
        if (window.AppUI) AppUI.setModuleError(item.key, motivo, () => carregarDados(mesParam));
    });
    setStatusUi(falhas.length ? 'error' : 'online');
    if (falhas.length) showToast('Alguns módulos não carregaram. O restante do painel continua disponível.', true);
}

function carregarDados(mesParam) { return monthLoader.load(mesParam); }
window.addEventListener('gastos:authenticated', () => {
    if (monthlyState.status === 'error') (monthlyState.retry || (() => carregarDados(monthlyState.key)))();
});
window.GastosMonthState = Object.freeze({ current: () => monthlyState });
window.mudarMes = mudarMes;
window.carregarDados = carregarDados;
