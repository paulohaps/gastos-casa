let chartPizzaInstance = null;
let resumoDados = { textoAcerto: "", detalhes: "" };
let mesAtualVigente = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
let idEmEdicao = null;
let usuarioOriginalEdicao = null;
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
        cancelExpenseEdit: cancelarEdicao,
        renderInsights,
        renderRadar: () => window.GastosRadar?.render()
    });
    window.GastosSmartEntry?.init({
        api,
        ui: window.AppUI,
        categories: CATEGORIAS_GASTOS,
        getCurrentExpenses: () => dadosMesAtual,
        cancelEdit: cancelarEdicao,
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
        aplicarFiltros();
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
            categoria: document.getElementById('inputCategoria').value,
            smartEntry: window.GastosSmartEntry?.getSubmissionMeta(estavaEditando) || null
        };

        try {
            const saveResult = await api.enviarGasto(payload);
            cancelarEdicao();
            showToast(estavaEditando ? 'Despesa atualizada!' : 'Despesa lançada!');
            if (!estavaEditando) {
                window.GastosSmartEntry?.afterExpenseSaved(saveResult, payload.smartEntry);
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
