(function () {
  'use strict';

  let ctx = null;
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

    if (ctx.isPreviousAvailable?.() === false) {
      valorEl.textContent = 'Indisponível';
      textoEl.textContent = 'Não foi possível consultar o período anterior.';
      iconeEl.className = 'icon-tile icon-tile--neutral';
      return;
    }
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

    const totalDinheiro = dados.filter(item => (item.formaPagamento || 'Dinheiro') !== 'Vale').reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    const totalVale = dados.filter(item => item.formaPagamento === 'Vale').reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
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
    const people = new Map();
    dados.forEach(item => people.set(item.usuario || 'Pessoa não informada', (people.get(item.usuario || 'Pessoa não informada') || 0) + (Number(item.valor) || 0)));
    summary.detalhes = '\n💰 *Total:* ' + ctx.formatCurrency(totalGeral) + '\n' +
      [...people].map(([name, value]) => '👤 *' + name + ':* ' + ctx.formatCurrency(value)).join('\n') + '\n';
    renderChart(dados);
  }

  function setRadarSummary(value) {
    summary.radar = value || '';
  }

  async function generateSummary() {
    const mesStr = ctx.getSelectedMonth();
    const texto = '🧾 *Resumo de Gastos - ' + mesStr + '*' +
      summary.detalhes + (summary.extras || '') + (summary.radar || '') +
      '\n⚖️ *Acerto de Contas:*\n' + summary.textoAcerto;

    try {
      await navigator.clipboard.writeText(texto);
      window.AppUI.toast('Resumo copiado!');
    } catch {
      await window.AppUI.confirmAction({ title: 'Resumo do mês', message: texto, confirmLabel: 'Fechar', cancelLabel: 'Voltar', variant: 'primary' });
    }
  }

  function renderChart(expenses) {
    const context = 'Casa · ' + ctx.getSelectedMonth();
    window.GastosCharts.render('chartDivisao', { expenses, field: 'usuario', context });
    window.GastosCharts.render('houseCategoryChart', { expenses, field: 'categoria', context });
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
