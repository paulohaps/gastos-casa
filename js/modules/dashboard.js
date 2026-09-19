(function () {
  'use strict';

  let deps = null;
  let chartInstance = null;
  const summary = { textoAcerto: '', detalhes: '', extras: '', radar: '' };

  function requireDeps() {
    if (!deps) throw new Error('GastosDashboard não inicializado.');
    return deps;
  }

  function getComparablePrevious() {
    const d = requireDeps();
    const selectedMonth = document.getElementById('seletorMes')?.value;
    const previous = d.getPreviousExpenses();
    if (selectedMonth !== d.getCurrentCalendarMonth()) return previous;

    const dayLimit = new Date().getDate();
    return previous.filter(item => {
      const day = Number(String(item.data || '').split('/')[0]);
      return Number.isFinite(day) && day <= dayLimit;
    });
  }

  function getComparisonLabel() {
    const d = requireDeps();
    return document.getElementById('seletorMes')?.value === d.getCurrentCalendarMonth()
      ? 'mesmo período do mês anterior'
      : 'mês anterior';
  }

  function renderComparison() {
    const d = requireDeps();
    const totalCurrent = d.totalize(d.getCurrentExpenses());
    const previousComparable = getComparablePrevious();
    const totalPrevious = d.totalize(previousComparable);
    const valueEl = document.getElementById('cardComparativoValor');
    const textEl = document.getElementById('cardComparativoTexto');
    const iconEl = document.getElementById('cardComparativoIcone');
    if (!valueEl || !textEl || !iconEl) return;

    let stateClass = 'icon-tile--neutral';
    if (totalPrevious <= 0) {
      valueEl.textContent = 'Sem base';
      textEl.textContent = 'Não há gastos suficientes no período anterior para comparar.';
    } else {
      const difference = totalCurrent - totalPrevious;
      const percentage = (difference / totalPrevious) * 100;
      valueEl.textContent = (difference > 0 ? '+' : '') + percentage.toFixed(1).replace('.', ',') + '%';
      const period = getComparisonLabel();

      if (Math.abs(difference) < 0.01) {
        textEl.textContent = 'Mesmo total do ' + period + '.';
      } else if (difference > 0) {
        textEl.textContent = d.formatCurrency(Math.abs(difference)) + ' acima do ' + period + '.';
        stateClass = 'icon-tile--danger';
      } else {
        textEl.textContent = d.formatCurrency(Math.abs(difference)) + ' abaixo do ' + period + '.';
        stateClass = 'icon-tile--success';
      }
    }

    iconEl.className = 'icon-tile ' + stateClass;
  }

  function renderInsights() {
    const d = requireDeps();
    const box = document.getElementById('insightsLista');
    if (!box) return;

    const insights = [];
    const current = d.getCurrentExpenses();
    const previousComparable = getComparablePrevious();
    const totalCurrent = d.totalize(current);
    const totalPrevious = d.totalize(previousComparable);

    if (totalPrevious > 0) {
      const difference = totalCurrent - totalPrevious;
      const percentage = Math.abs((difference / totalPrevious) * 100);
      if (percentage >= 5) {
        insights.push('Gastos estão ' + percentage.toFixed(0) + '% ' + (difference > 0 ? 'acima' : 'abaixo') + ' do ' + getComparisonLabel() + '.');
      }
    }

    const currentCategories = d.totalsByCategory(current);
    const previousCategories = d.totalsByCategory(previousComparable);
    let biggestIncrease = null;
    d.categories.forEach(category => {
      const increase = (currentCategories[category] || 0) - (previousCategories[category] || 0);
      if (!biggestIncrease || increase > biggestIncrease.value) biggestIncrease = { category, value: increase };
    });

    if (biggestIncrease && biggestIncrease.value > 0 && totalPrevious > 0) {
      insights.push((biggestIncrease.category === 'Ifood' ? 'iFood' : biggestIncrease.category) + ' foi a categoria que mais aumentou: +' + d.formatCurrency(biggestIncrease.value) + '.');
    }

    const budgetMap = {};
    (d.getBudgets() || []).forEach(item => { budgetMap[item.categoria] = Number(item.valor_limite) || 0; });
    const exceeded = d.categories.filter(category => budgetMap[category] > 0 && currentCategories[category] > budgetMap[category]);
    if (exceeded.length) {
      insights.push(exceeded.length + (exceeded.length === 1 ? ' categoria passou' : ' categorias passaram') + ' do orçamento.');
    }

    const pending = (d.getRecurring() || []).filter(item => item.ativo !== false && !d.recurringWasPosted(item));
    if (pending.length) {
      insights.push(pending.length + (pending.length === 1 ? ' recorrente ainda não aparece' : ' recorrentes ainda não aparecem') + ' neste mês.');
    }

    if (!insights.length) insights.push('Nenhum alerta relevante encontrado para este mês.');

    box.innerHTML = '';
    insights.slice(0, 3).forEach(text => {
      const row = document.createElement('p');
      row.className = 'insight-row';
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-wand-magic-sparkles';
      const span = document.createElement('span');
      span.textContent = text;
      row.append(icon, span);
      box.appendChild(row);
    });

    summary.extras = '\n📊 *Comparativo:* ' + (document.getElementById('cardComparativoValor')?.textContent || '—') +
      '\n🎯 *Orçamento:* ' + (document.getElementById('cardOrcamentoValor')?.textContent || 'Sem meta') + '\n';
  }

  function renderChart(v1, v2, attempt) {
    attempt = attempt || 0;
    const canvas = document.getElementById('chartDivisao');
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
      if (attempt < 5) setTimeout(() => renderChart(v1, v2, attempt + 1), 600);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
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

  function renderOverview(expenses) {
    const d = requireDeps();
    let pauloCash = 0, pauloVale = 0, fernandoCash = 0, fernandoVale = 0;

    (expenses || []).forEach(expense => {
      const value = Number(expense.valor) || 0;
      const payment = expense.formaPagamento || 'Dinheiro';
      if (expense.usuario === 'Paulo Henrique') {
        if (payment === 'Vale') pauloVale += value;
        else pauloCash += value;
      } else if (expense.usuario === 'Fernando Gustavo') {
        if (payment === 'Vale') fernandoVale += value;
        else fernandoCash += value;
      }
    });

    const totalCash = pauloCash + fernandoCash;
    const totalVale = pauloVale + fernandoVale;
    const total = totalCash + totalVale;
    const pauloTotal = pauloCash + pauloVale;
    const fernandoTotal = fernandoCash + fernandoVale;

    document.getElementById('cardTotal').innerText = d.formatCurrency(total);
    document.getElementById('cardSubtotalGeral').innerText = '(' + d.formatCurrency(totalCash) + ' Dinheiro | ' + d.formatCurrency(totalVale) + ' Vale)';
    document.getElementById('cardPaulo').innerText = d.formatCurrency(pauloTotal);
    document.getElementById('cardSubtotalPaulo').innerText = '(' + d.formatCurrency(pauloCash) + ' Dinh. | ' + d.formatCurrency(pauloVale) + ' Vale)';
    document.getElementById('cardGustavo').innerText = d.formatCurrency(fernandoTotal);
    document.getElementById('cardSubtotalGustavo').innerText = '(' + d.formatCurrency(fernandoCash) + ' Dinh. | ' + d.formatCurrency(fernandoVale) + ' Vale)';

    const pauloCashBalance = pauloCash - (totalCash / 2);
    const pauloValeBalance = pauloVale - (totalVale / 2);
    const cashBox = document.getElementById('boxAcertoDinheiro');
    const valeBox = document.getElementById('boxAcertoVale');

    let cashSummary = '';
    let valeSummary = '';

    if (Math.abs(pauloCashBalance) < 0.05) {
      cashBox.innerHTML = '<p class="settlement"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: <strong>Tudo quite!</strong></p>';
      cashSummary = 'Dinheiro: Tudo quite!';
    } else if (pauloCashBalance < 0) {
      cashBox.innerHTML = '<p class="settlement settlement--danger"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: Paulo deve ' + d.formatCurrency(Math.abs(pauloCashBalance)) + ' a Fernando</p>';
      cashSummary = 'Dinheiro: Paulo deve transferir ' + d.formatCurrency(Math.abs(pauloCashBalance)) + ' para Fernando';
    } else {
      cashBox.innerHTML = '<p class="settlement settlement--success"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro: Fernando deve ' + d.formatCurrency(Math.abs(pauloCashBalance)) + ' a Paulo</p>';
      cashSummary = 'Dinheiro: Fernando deve transferir ' + d.formatCurrency(Math.abs(pauloCashBalance)) + ' para Paulo';
    }

    if (Math.abs(pauloValeBalance) < 0.05) {
      valeBox.innerHTML = '<p class="settlement"><i class="fa-solid fa-ticket"></i> Vale iFood: <strong>Tudo quite!</strong></p>';
      valeSummary = 'Vale iFood: Tudo quite!';
    } else if (pauloValeBalance < 0) {
      valeBox.innerHTML = '<p class="settlement settlement--warning"><i class="fa-solid fa-ticket"></i> Vale iFood: Paulo deve pagar ' + d.formatCurrency(Math.abs(pauloValeBalance)) + ' no iFood para Fernando</p>';
      valeSummary = 'Vale iFood: Paulo deve pagar ' + d.formatCurrency(Math.abs(pauloValeBalance)) + ' de lanche para Fernando';
    } else {
      valeBox.innerHTML = '<p class="settlement settlement--warning"><i class="fa-solid fa-ticket"></i> Vale iFood: Fernando deve pagar ' + d.formatCurrency(Math.abs(pauloValeBalance)) + ' no iFood para Paulo</p>';
      valeSummary = 'Vale iFood: Fernando deve pagar ' + d.formatCurrency(Math.abs(pauloValeBalance)) + ' de lanche para Paulo';
    }

    summary.textoAcerto = '👉 ' + cashSummary + '\n👉 ' + valeSummary;
    summary.detalhes = '\n💰 *Total:* ' + d.formatCurrency(total) + '\n👤 *Paulo:* ' + d.formatCurrency(pauloTotal) + '\n🧑‍🚀 *Fernando:* ' + d.formatCurrency(fernandoTotal) + '\n';

    renderChart(pauloTotal, fernandoTotal);
  }

  function setRadarSummary(value) {
    summary.radar = value || '';
  }

  function copySummary() {
    const month = document.getElementById('seletorMes')?.value || '';
    const text = '🧾 *Resumo de Gastos - ' + month + '*' + summary.detalhes +
      (summary.extras || '') + (summary.radar || '') + '\n⚖️ *Acerto de Contas:*\n' + summary.textoAcerto;

    navigator.clipboard.writeText(text)
      .then(() => alert('Resumo copiado!\n\n' + text))
      .catch(() => alert(text));
  }

  function init(options) {
    deps = options;
  }

  window.GastosDashboard = {
    init,
    renderOverview,
    renderComparison,
    renderInsights,
    getComparablePrevious,
    getComparisonLabel,
    setRadarSummary,
    copySummary
  };
})();