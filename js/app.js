let chartPizzaInstance = null;
let resumoDados = { textoAcerto: "", detalhes: "" };
let mesAtualVigente = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
let idEmEdicao = null;
let usuarioOriginalEdicao = null;
let dadosMesAtual = [];
let dadosMesAnterior = [];
let orcamentosAtuais = [];
let recorrentesAtuais = [];
const CATEGORIAS_GASTOS = ['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'];


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('Sem PWA por enquanto.'));
    });
}

window.onload = () => {
    document.getElementById('inputData').valueAsDate = new Date();
    carregarMesesDisponiveis();
};

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('i');
    icon.className = isError ? "fa-solid fa-circle-xmark text-red-400" : "fa-solid fa-circle-check text-emerald-400";
    document.getElementById('toastMsg').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

function setStatusUi(state) {
    const el = document.getElementById('connectionStatus');
    el.classList.remove('hidden');
    el.className = 'flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full border transition-colors duration-300';
    if (state === 'loading') {
        el.classList.add('text-amber-500', 'bg-amber-50', 'border-amber-200');
        el.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Sincronizando...';
    } else if (state === 'online') {
        el.classList.add('text-emerald-600', 'bg-emerald-50', 'border-emerald-200');
        el.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Conectado';
    } else if (state === 'error') {
        el.classList.add('text-red-600', 'bg-red-50', 'border-red-200');
        el.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> Atenção';
    }
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

        const falha = resultadosExtras.findIndex(item => item.status === 'rejected');
        if (falha >= 0) {
            const nomes = ['comparativo', 'orçamento', 'recorrentes'];
            const motivo = resultadosExtras[falha].reason?.message || 'Falha ao carregar recurso.';
            console.error('Falha em módulo extra:', nomes[falha], resultadosExtras[falha].reason);
            setStatusUi('error');
            showToast('Falha em ' + nomes[falha] + ': ' + motivo, true);
        } else {
            setStatusUi('online');
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setStatusUi('error');
        showToast(error?.message || 'Erro ao ler dados.', true);
    } finally {
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

    if (totalAnterior <= 0) {
        valorEl.textContent = 'Sem base';
        textoEl.textContent = 'Não há gastos suficientes no período anterior para comparar.';
        iconeEl.className = 'w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center';
        return;
    }

    const diferenca = totalAtual - totalAnterior;
    const percentual = (diferenca / totalAnterior) * 100;
    valorEl.textContent = (diferenca > 0 ? '+' : '') + percentual.toFixed(1).replace('.', ',') + '%';

    const periodo = textoPeriodoComparativo();
    if (Math.abs(diferenca) < 0.01) {
        textoEl.textContent = 'Mesmo total do ' + periodo + '.';
        iconeEl.className = 'w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center';
    } else if (diferenca > 0) {
        textoEl.textContent = formatarMoeda(Math.abs(diferenca)) + ' acima do ' + periodo + '.';
        iconeEl.className = 'w-11 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center';
    } else {
        textoEl.textContent = formatarMoeda(Math.abs(diferenca)) + ' abaixo do ' + periodo + '.';
        iconeEl.className = 'w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center';
    }
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

    const totalMeta = Object.values(mapa).reduce(function(total, valor) { return total + Number(valor || 0); }, 0);
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
        barra.className = 'h-full bg-indigo-600 rounded-full transition-all duration-500';
    } else {
        const percentual = (totalGasto / totalMeta) * 100;
        cardValor.textContent = formatarMoeda(totalGasto) + ' / ' + formatarMoeda(totalMeta);
        resumo.textContent = percentual.toFixed(0) + '% do orçamento utilizado • restante ' + formatarMoeda(Math.max(0, totalMeta - totalGasto));
        barra.style.width = Math.min(100, percentual) + '%';
        barra.className = 'h-full rounded-full transition-all duration-500 ' + (percentual > 100 ? 'bg-red-500' : percentual >= 80 ? 'bg-amber-500' : 'bg-indigo-600');
    }

    detalhes.innerHTML = '';
    CATEGORIAS_GASTOS.forEach(function(cat) {
        const limite = mapa[cat] || 0;
        const gasto = gastosCategoria[cat] || 0;
        const percentual = limite > 0 ? (gasto / limite) * 100 : 0;
        const card = document.createElement('div');
        card.className = 'rounded-xl border border-slate-100 bg-slate-50 p-3';
        card.innerHTML =
            '<div class="flex items-center justify-between gap-2">' +
                '<span class="text-xs font-bold text-slate-600">' + escapeHTML(cat === 'Ifood' ? 'iFood' : cat) + '</span>' +
                '<span class="text-[11px] text-slate-400">' + (limite > 0 ? percentual.toFixed(0) + '%' : 'sem meta') + '</span>' +
            '</div>' +
            '<p class="text-sm font-bold text-slate-800 mt-1">' + formatarMoeda(gasto) + '</p>' +
            '<p class="text-[11px] text-slate-400">' + (limite > 0 ? 'de ' + formatarMoeda(limite) : 'Defina uma meta') + '</p>';
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
        botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Salvando...';
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

    const ativos = recorrentesAtuais.filter(function(item) { return item.ativo !== false; });
    if (ativos.length === 0) {
        lista.innerHTML = '<div class="text-center py-5 text-sm text-slate-400"><i class="fa-solid fa-repeat block text-2xl text-slate-200 mb-2"></i>Nenhum recorrente cadastrado.</div>';
        return;
    }

    lista.innerHTML = '';
    ativos.forEach(function(item) {
        const lancado = recorrenteFoiLancado(item);
        const linha = document.createElement('div');
        linha.className = 'border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3';
        linha.innerHTML =
            '<div class="min-w-0">' +
                '<div class="flex items-center gap-2">' +
                    '<p class="text-sm font-bold text-slate-700 truncate">' + escapeHTML(item.descricao) + '</p>' +
                    '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ' + (lancado ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600') + '">' + (lancado ? 'LANÇADO' : 'PENDENTE') + '</span>' +
                '</div>' +
                '<p class="text-xs text-slate-400 mt-1">Dia ' + Number(item.dia_vencimento) + ' • ' + formatarMoeda(Number(item.valor)) + ' • ' + escapeHTML(item.categoria) + '</p>' +
            '</div>' +
            '<div class="flex items-center gap-1 shrink-0">' +
                '<button type="button" onclick="usarRecorrente(\'' + escapeHTML(item.id) + '\')" class="w-8 h-8 rounded-lg text-indigo-500 hover:bg-indigo-50" title="Lançar agora"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>' +
                '<button type="button" onclick="editarRecorrente(\'' + escapeHTML(item.id) + '\')" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100" title="Editar"><i class="fa-solid fa-pen"></i></button>' +
                '<button type="button" onclick="deletarRecorrente(\'' + escapeHTML(item.id) + '\')" class="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50" title="Excluir"><i class="fa-solid fa-trash"></i></button>' +
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
    if (!confirm('Excluir este gasto recorrente?')) return;
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
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-50';

        const tdData = document.createElement('td');
        tdData.className = 'py-3 px-4 sm:px-6 text-sm text-slate-500 whitespace-nowrap';
        tdData.textContent = gasto.data || '';

        const tdDesc = document.createElement('td');
        tdDesc.className = 'py-3 px-4 sm:px-6 text-sm text-slate-800 font-medium';
        const desc = document.createElement('div');
        desc.textContent = gasto.descricao || '';
        const cat = document.createElement('div');
        cat.className = 'text-xs text-slate-400 font-normal mt-0.5';
        cat.textContent = gasto.categoria || 'Outros';
        tdDesc.append(desc, cat);

        const tdQuem = document.createElement('td');
        tdQuem.className = 'py-3 px-4 sm:px-6 text-sm';
        const quemWrap = document.createElement('div');
        quemWrap.className = 'flex flex-col items-start gap-1';
        const pessoa = document.createElement('span');
        pessoa.className = gasto.usuario === 'Paulo Henrique'
            ? 'bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider'
            : 'bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider';
        pessoa.textContent = gasto.usuario === 'Paulo Henrique' ? 'Paulo' : 'Fernando';
        const pagamento = document.createElement('span');
        pagamento.className = forma === 'Vale' ? 'text-xs text-orange-500' : 'text-xs text-slate-400';
        pagamento.innerHTML = forma === 'Vale'
            ? '<i class="fa-solid fa-ticket"></i> iFood'
            : '<i class="fa-solid fa-money-bill-transfer"></i> Dinheiro';
        quemWrap.append(pessoa, pagamento);
        tdQuem.appendChild(quemWrap);

        const tdValor = document.createElement('td');
        tdValor.className = 'py-3 px-4 sm:px-6 text-sm text-slate-800 font-bold text-right whitespace-nowrap';
        tdValor.textContent = formatarMoeda(valor);

        const tdAcoes = document.createElement('td');
        tdAcoes.className = 'py-3 px-3 text-center whitespace-nowrap';
        const acoes = document.createElement('div');
        acoes.className = 'flex justify-center gap-1';

        const criarBotao = (titulo, icon, classe, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = titulo;
            btn.className = classe;
            btn.innerHTML = '<i class="' + icon + '"></i>';
            btn.addEventListener('click', onClick);
            return btn;
        };

        acoes.append(
            criarBotao('Duplicar', 'fa-solid fa-copy', 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 p-2 rounded transition', () => duplicarGasto(gasto.id)),
            criarBotao('Editar', 'fa-solid fa-pen', 'text-slate-300 hover:text-amber-500 hover:bg-amber-50 p-2 rounded transition', () => prepararEdicao(gasto.id, gasto.data, gasto.descricao, valor, gasto.usuario, forma, gasto.categoria || 'Outros')),
            criarBotao('Apagar', 'fa-solid fa-trash-can', 'text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded transition', event => deletarGasto(gasto.id, event.currentTarget))
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
        p.className = 'flex gap-2';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-wand-magic-sparkles text-indigo-300 mt-0.5';
        const span = document.createElement('span');
        span.textContent = texto;
        p.append(icon, span);
        box.appendChild(p);
    });

    resumoDados.extras = '\n📊 *Comparativo:* ' + (document.getElementById('cardComparativoValor')?.textContent || '—') +
        '\n🎯 *Orçamento:* ' + (document.getElementById('cardOrcamentoValor')?.textContent || 'Sem meta') + '\n';
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
