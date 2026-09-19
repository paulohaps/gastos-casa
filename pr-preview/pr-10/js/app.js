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
        const mesAnterior2 = obterMesAnterior(mesAnterior);
        const mesAnterior3 = obterMesAnterior(mesAnterior2);
        const resultadosExtras = await Promise.allSettled([
            api.fetchGastosPorMes(mesAnterior),
            api.fetchOrcamentos(mesParam),
            api.fetchRecorrentes(),
            api.fetchGastosPorMes(mesAnterior2),
            api.fetchGastosPorMes(mesAnterior3)
        ]);

        dadosMesAtual = dados;
        dadosMesAnterior = resultadosExtras[0].status === 'fulfilled' ? resultadosExtras[0].value : [];
        window.GastosBudgets?.setItems(resultadosExtras[1].status === 'fulfilled' ? resultadosExtras[1].value : []);
        window.GastosRecurring?.setItems(resultadosExtras[2].status === 'fulfilled' ? resultadosExtras[2].value : []);

        const historicoBehavior = [
            resultadosExtras[0].status === 'fulfilled' ? { month: mesAnterior, expenses: resultadosExtras[0].value } : null,
            resultadosExtras[3].status === 'fulfilled' ? { month: mesAnterior2, expenses: resultadosExtras[3].value } : null,
            resultadosExtras[4].status === 'fulfilled' ? { month: mesAnterior3, expenses: resultadosExtras[4].value } : null
        ].filter(Boolean);

        behaviorResult = window.GastosBehaviorEngine?.analyze({
            currentExpenses: dadosMesAtual,
            historyMonths: historicoBehavior,
            recurring: window.GastosRecurring?.getItems() || [],
            currentMonth: mesParam,
            currentDay: new Date().getDate(),
            isCurrentMonth: mesParam === mesAtualVigente
        }) || behaviorResult;

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

window.mudarMes = mudarMes;
window.carregarDados = carregarDados;
