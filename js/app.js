let chartPizzaInstance = null;
let resumoDados = { textoAcerto: "", detalhes: "" };
let mesAtualVigente = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
let dadosMesAtual = [];
let dadosMesAnterior = [];
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
        renderInsights,
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
        renderInsights,
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
        getComparablePrevious: dadosAnterioresComparaveis,
        getComparisonLabel: textoPeriodoComparativo,
        setSummaryRadar: value => { resumoDados.radar = value; }
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
        window.GastosBudgets?.setItems(resultadosExtras[1].status === 'fulfilled' ? resultadosExtras[1].value : []);
        window.GastosRecurring?.setItems(resultadosExtras[2].status === 'fulfilled' ? resultadosExtras[2].value : []);

        atualizarDashboards(dadosMesAtual);
        renderComparativoMensal();
        window.GastosBudgets?.render();
        window.GastosRecurring?.render();
        window.GastosExpenses?.applyFilters();
        renderInsights();
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
    (window.GastosBudgets?.getItems() || []).forEach(item => { mapaMetas[item.categoria] = Number(item.valor_limite) || 0; });
    const estouradas = CATEGORIAS_GASTOS.filter(cat => mapaMetas[cat] > 0 && categoriasAtual[cat] > mapaMetas[cat]);
    if (estouradas.length) {
        insights.push(estouradas.length + (estouradas.length === 1 ? ' categoria passou' : ' categorias passaram') + ' do orçamento.');
    }

    const pendentes = (window.GastosRecurring?.getItems() || []).filter(item =>
        item.ativo !== false && !(window.GastosRecurring?.wasPosted(item))
    );
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
