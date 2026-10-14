(function () {
  'use strict';

  let ctx = null;

  function init(options) {
    ctx = options;
  }

  function requireContext() {
    if (!ctx) throw new Error('RadarModule não inicializado.');
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
    for (let i = 0; i < ctx.getCurrentExpenses().length; i++) {
        const a = ctx.getCurrentExpenses()[i];
        for (let j = i + 1; j < ctx.getCurrentExpenses().length; j++) {
            const b = ctx.getCurrentExpenses()[j];
            const mesmoValor = Math.abs((Number(a.valor) || 0) - (Number(b.valor) || 0)) < 0.01;
            const mesmaDescricao = ctx.normalizeText(a.descricao) && ctx.normalizeText(a.descricao) === ctx.normalizeText(b.descricao);
            const mesmaForma = (a.formaPagamento || 'Dinheiro') === (b.formaPagamento || 'Dinheiro');
            if (!mesmoValor || !mesmaDescricao || !mesmaForma) continue;

            const da = dataBrParaDate(a.data);
            const db = dataBrParaDate(b.data);
            const diffDias = da && db ? Math.abs(da - db) / 86400000 : 99;
            if (diffDias <= 1) {
                alertas.push({
                    nivel: 'warning',
                    titulo: 'Possível gasto duplicado',
                    texto: (a.descricao || 'Lançamento') + ' • ' + ctx.formatCurrency(Number(a.valor) || 0) + ' em datas próximas.'
                });
                if (alertas.length >= 2) return alertas;
            }
        }
    }
    return alertas;
}

function calcularRadarFinanceiro() {
    const mesSelecionado = document.getElementById('seletorMes')?.value || ctx.getCurrentMonth();
    const totalAtual = ctx.totalize(ctx.getCurrentExpenses());
    const agora = new Date();
    const [mesNum, anoNum] = mesSelecionado.split('/').map(Number);
    const diasNoMes = mesNum && anoNum ? new Date(anoNum, mesNum, 0).getDate() : 30;
    const mesAtualSelecionado = mesSelecionado === ctx.getCurrentMonth();
    const diaReferencia = mesAtualSelecionado ? Math.max(1, agora.getDate()) : diasNoMes;

    const pendentes = ctx.getRecurring().filter(item => item.ativo !== false && !ctx.recurringWasPosted(item));
    const valorPendentes = pendentes.reduce((total, item) => total + (Number(item.valor) || 0), 0);

    let projecao = totalAtual;
    let projecaoTexto = 'Mês encerrado: projeção igual ao total realizado.';
    if (mesAtualSelecionado) {
        const ritmo = diaReferencia >= 3 ? (totalAtual / diaReferencia) * diasNoMes : totalAtual;
        projecao = Math.max(totalAtual + valorPendentes, ritmo);
        projecaoTexto = 'Estimativa pelo ritmo atual' + (valorPendentes > 0 ? ' e pelos recorrentes ainda pendentes.' : '.');
    }

    const gastosCategoria = ctx.totalsByCategory(ctx.getCurrentExpenses());
    const metas = {};
    ctx.getBudgets().forEach(item => { metas[item.categoria] = Number(item.valor_limite) || 0; });

    const categoriasRisco = [];
    ctx.categories.forEach(cat => {
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

    const anterior = ctx.getComparablePrevious();
    const catAtual = ctx.totalsByCategory(ctx.getCurrentExpenses());
    const catAnterior = ctx.totalsByCategory(anterior);
    ctx.categories.forEach(cat => {
        const atual = catAtual[cat] || 0;
        const prev = catAnterior[cat] || 0;
        if (prev >= 50 && atual - prev >= 50) {
            const alta = ((atual - prev) / prev) * 100;
            if (alta >= 25) {
                alertas.push({
                    nivel:'info',
                    titulo:'Categoria acelerando',
                    texto:(cat === 'Ifood' ? 'iFood' : cat) + ' está ' + alta.toFixed(0) + '% acima do ' + ctx.getComparisonLabel() + '.'
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
    projecaoValor.textContent = ctx.formatCurrency(radar.projecao);
    projecaoTexto.textContent = radar.projecaoTexto;

    pendentesValor.textContent = String(radar.pendentes.length);
    pendentesTexto.textContent = radar.pendentes.length
        ? ctx.formatCurrency(radar.valorPendentes) + ' ainda previstos.'
        : 'Nenhum recorrente pendente identificado.';

    if (!ctx.getBudgets().length) {
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
                '<div><strong>' + ctx.escapeHTML(alerta.titulo) + '</strong><p>' + ctx.escapeHTML(alerta.texto) + '</p></div>';
            lista.appendChild(item);
        });
    }

    const temCritico = radar.alertas.some(a => a.nivel === 'danger');
    const temAtencao = radar.alertas.some(a => a.nivel === 'warning');
    status.className = 'status-badge ' + (temCritico ? 'status-badge--danger' : temAtencao ? 'status-badge--warning' : 'status-badge--success');
    status.textContent = temCritico ? 'Ação necessária' : temAtencao ? 'Atenção' : 'Estável';

    ctx.setSummaryRadar('\n🔭 *Projeção:* ' + ctx.formatCurrency(radar.projecao) +
        '\n⚠️ *Alertas:* ' + radar.alertas.length + '\n');
}



  function render() {
    requireContext();
    return renderRadarFinanceiro();
  }

  window.GastosRadar = {
    init,
    render,
    calculate: calcularRadarFinanceiro
  };
})();
