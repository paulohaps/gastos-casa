let mesAtualVigente = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
let dadosMesAtual = [];
let dadosMesAnterior = [];
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


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('Sem PWA por enquanto.'));
    });
}

function inicializarApp() {
    const dataInput = document.getElementById('inputData');
    if (dataInput) dataInput.valueAsDate = new Date();
    carregarMesesDisponiveis();
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
    window.GastosDashboard?.init({
        getCurrentExpenses: () => dadosMesAtual,
        getPreviousExpenses: () => dadosMesAnterior,
        getSelectedMonth: () => document.getElementById('seletorMes')?.value || mesAtualVigente,
        getCurrentMonth: () => mesAtualVigente,
        categories: CATEGORIAS_GASTOS,
        totalize: totalizar,
        totalsByCategory: totaisPorCategoria,
        formatCurrency: formatarMoeda,
        getBudgets: () => window.GastosBudgets?.getItems() || [],
        getRecurring: () => window.GastosRecurring?.getItems() || [],
        recurringWasPosted: item => window.GastosRecurring?.wasPosted(item) || false
    });
    window.GastosMembers?.init({ api, showToast, escapeHTML });
    window.GastosMembers?.load();
    window.GastosBudgets?.init({
        api,
        categories: CATEGORIAS_GASTOS,
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
    window.GastosRadar?.init({
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

window.mudarMes = mudarMes;
window.carregarDados = carregarDados;
