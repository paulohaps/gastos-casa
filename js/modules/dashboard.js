(function () {
  'use strict';

  let ctx = null;
  let chartPizzaInstance = null;
  const summary = { textoAcerto: '', detalhes: '', extras: '', radar: '' };

  function init(options) {
    ctx = options;
  }

  function getComparablePrevious() {
    const mesSelecionado = ctx.getSelectedMonth();
    if (mesSelecionado !== ctx.getCurrentMonth()) return ctx.getPreviousExpenses();

    const diaLimite = new Date().getDate();
    return ctx.getPreviousExpenses().filter(item => {
      const dia = Number(String(item.data || '').split('/')[0]);
      return Number.isFinite(dia) && dia <= diaLimite;
    });
  }

  function getComparisonLabel() {
    return ctx.getSelectedMonth() === ctx.getCurrentMonth()
      ? 'mesmo período do mês anterior'
      : 'mês anterior';
  }

  function renderComparison() {
    const totalAtual = ctx.totalize(ctx.getCurrentExpenses());
    const anteriorComparavel = getComparablePrevious();
    const totalAnterior = ctx.totalize(anteriorComparavel);
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
      const periodo = getComparisonLabel();

      if (Math.abs(diferenca) < 0.01) {
        textoEl.textContent = 'Mesmo total do ' + periodo + '.';
      } else if (diferenca > 0) {
        textoEl.textContent = ctx.formatCurrency(Math.abs(diferenca)) + ' acima do ' + periodo + '.';
        stateClass = 'icon-tile--danger';
      } else {
        textoEl.textContent = ctx.formatCurrency(Math.abs(diferenca)) + ' abaixo do ' + periodo + '.';
        stateClass = 'icon-tile--success';
      }
    }

    iconeEl.className = 'icon-tile ' + stateClass;
  }

  function renderInsights() {
    window.GastosInsights?.render();

    summary.extras = '\n📊 *Comparativo:* ' +
      (document.getElementById('cardComparativoValor')?.textContent || '—') +
      '\n🎯 *Orçamento:* ' +
      (document.getElementById('cardOrcamentoValor')?.textContent || 'Sem meta') +
      (window.GastosInsights?.shareText?.() || '') + '\n';
  }

  function updateMain(dados) {
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

    document.getElementById('cardTotal').innerText = ctx.formatCurrency(totalGeral);
    document.getElementById('cardSubtotalGeral').innerText =
      '(' + ctx.formatCurrency(totalDinheiro) + ' Dinheiro | ' + ctx.formatCurrency(totalVale) + ' Vale)';
    document.getElementById('cardPaulo').innerText = ctx.formatCurrency(totalPaulo);
    document.getElementById('cardSubtotalPaulo').innerText =
      '(' + ctx.formatCurrency(pauloDinheiro) + ' Dinh. | ' + ctx.formatCurrency(pauloVale) + ' Vale)';
    document.getElementById('cardGustavo').innerText = ctx.formatCurrency(totalGustavo);
    document.getElementById('cardSubtotalGustavo').innerText =
      '(' + ctx.formatCurrency(gustavoDinheiro) + ' Dinh. | ' + ctx.formatCurrency(gustavoVale) + ' Vale)';

    window.GastosSettlements?.render(dados);
    summary.textoAcerto = '👉 ' + (window.GastosSettlements?.summaryText() || 'Sem dados de acerto');
    summary.detalhes =
      '\n💰 *Total:* ' + ctx.formatCurrency(totalGeral) +
      '\n👤 *Paulo:* ' + ctx.formatCurrency(totalPaulo) +
      '\n🧑‍🚀 *Fernando:* ' + ctx.formatCurrency(totalGustavo) + '\n';

    renderChart(totalPaulo, totalGustavo);
  }

  function setRadarSummary(value) {
    summary.radar = value || '';
  }

  function generateSummary() {
    const mesStr = ctx.getSelectedMonth();
    const texto = '🧾 *Resumo de Gastos - ' + mesStr + '*' +
      summary.detalhes + (summary.extras || '') + (summary.radar || '') +
      '\n⚖️ *Acerto de Contas:*\n' + summary.textoAcerto;

    navigator.clipboard.writeText(texto)
      .then(() => alert('Resumo copiado!\n\n' + texto))
      .catch(() => alert(texto));
  }

  function renderChart(v1, v2, tentativa = 0) {
    const canvas = document.getElementById('chartDivisao');
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
      if (tentativa < 5) setTimeout(() => renderChart(v1, v2, tentativa + 1), 600);
      return;
    }

    const chartCtx = canvas.getContext('2d');
    if (chartPizzaInstance) chartPizzaInstance.destroy();
    chartPizzaInstance = new Chart(chartCtx, {
      type: 'doughnut',
      data: {
        labels: ['Paulo Henrique', 'Fernando Gustavo'],
        datasets: [{
          data: [v1, v2],
          backgroundColor: ['#4f46e5', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  window.GastosDashboard = {
    init,
    getComparablePrevious,
    getComparisonLabel,
    renderComparison,
    renderInsights,
    updateMain,
    setRadarSummary,
    generateSummary
  };

  window.gerarResumo = generateSummary;
  window.atualizarDashboards = updateMain;
})();
