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
    const box = document.getElementById('insightsLista');
    if (!box) return;

    const insights = [];
    const anteriorComparavel = getComparablePrevious();
    const totalAtual = ctx.totalize(ctx.getCurrentExpenses());
    const totalAnterior = ctx.totalize(anteriorComparavel);

    if (totalAnterior > 0) {
      const diferenca = totalAtual - totalAnterior;
      const percentual = Math.abs((diferenca / totalAnterior) * 100);
      if (percentual >= 5) {
        insights.push('Gastos estão ' + percentual.toFixed(0) + '% ' +
          (diferenca > 0 ? 'acima' : 'abaixo') + ' do ' + getComparisonLabel() + '.');
      }
    }

    const categoriasAtual = ctx.totalsByCategory(ctx.getCurrentExpenses());
    const categoriasAnterior = ctx.totalsByCategory(anteriorComparavel);
    let maiorAlta = null;
    ctx.categories.forEach(cat => {
      const alta = (categoriasAtual[cat] || 0) - (categoriasAnterior[cat] || 0);
      if (!maiorAlta || alta > maiorAlta.valor) maiorAlta = { categoria: cat, valor: alta };
    });

    if (maiorAlta && maiorAlta.valor > 0 && totalAnterior > 0) {
      insights.push((maiorAlta.categoria === 'Ifood' ? 'iFood' : maiorAlta.categoria) +
        ' foi a categoria que mais aumentou: +' + ctx.formatCurrency(maiorAlta.valor) + '.');
    }

    const mapaMetas = {};
    ctx.getBudgets().forEach(item => { mapaMetas[item.categoria] = Number(item.valor_limite) || 0; });
    const estouradas = ctx.categories.filter(cat => mapaMetas[cat] > 0 && categoriasAtual[cat] > mapaMetas[cat]);
    if (estouradas.length) {
      insights.push(estouradas.length +
        (estouradas.length === 1 ? ' categoria passou' : ' categorias passaram') +
        ' do orçamento.');
    }

    const pendentes = ctx.getRecurring().filter(item =>
      item.ativo !== false && !ctx.recurringWasPosted(item)
    );
    if (pendentes.length) {
      insights.push(pendentes.length +
        (pendentes.length === 1 ? ' recorrente ainda não aparece' : ' recorrentes ainda não aparecem') +
        ' neste mês.');
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

    summary.extras = '\n📊 *Comparativo:* ' +
      (document.getElementById('cardComparativoValor')?.textContent || '—') +
      '\n🎯 *Orçamento:* ' +
      (document.getElementById('cardOrcamentoValor')?.textContent || 'Sem meta') + '\n';
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
      boxDinh.innerHTML = '<p class="settlement settlement--danger"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: Paulo deve ' +
        ctx.formatCurrency(Math.abs(saldoPauloDinheiro)) + ' a Fernando</p>';
      txtResumoDinh = 'Dinheiro: Paulo deve transferir ' +
        ctx.formatCurrency(Math.abs(saldoPauloDinheiro)) + ' para Fernando';
    } else {
      boxDinh.innerHTML = '<p class="settlement settlement--success"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: Fernando deve ' +
        ctx.formatCurrency(Math.abs(saldoPauloDinheiro)) + ' a Paulo</p>';
      txtResumoDinh = 'Dinheiro: Fernando deve transferir ' +
        ctx.formatCurrency(Math.abs(saldoPauloDinheiro)) + ' para Paulo';
    }

    if (Math.abs(saldoPauloVale) < 0.05) {
      boxVale.innerHTML = '<p class="settlement"><i class="fa-solid fa-ticket"></i> Vale iFood: <strong>Tudo quite!</strong></p>';
      txtResumoVale = 'Vale iFood: Tudo quite!';
    } else if (saldoPauloVale < 0) {
      boxVale.innerHTML = '<p class="settlement settlement--warning"><i class="fa-solid fa-ticket"></i> Vale iFood: Paulo deve pagar ' +
        ctx.formatCurrency(Math.abs(saldoPauloVale)) + ' no iFood para Fernando</p>';
      txtResumoVale = 'Vale iFood: Paulo deve pagar ' +
        ctx.formatCurrency(Math.abs(saldoPauloVale)) + ' de lanche para Fernando';
    } else {
      boxVale.innerHTML = '<p class="settlement settlement--warning"><i class="fa-solid fa-ticket"></i> Vale iFood: Fernando deve pagar ' +
        ctx.formatCurrency(Math.abs(saldoPauloVale)) + ' no iFood para Paulo</p>';
      txtResumoVale = 'Vale iFood: Fernando deve pagar ' +
        ctx.formatCurrency(Math.abs(saldoPauloVale)) + ' de lanche para Paulo';
    }

    summary.textoAcerto = '👉 ' + txtResumoDinh + '\n👉 ' + txtResumoVale;
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
})();
