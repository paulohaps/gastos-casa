(function () {
  'use strict';

  let ctx = null;
  let lastItems = [];

  function init(options) {
    ctx = options;
  }

  function money(value) {
    return ctx?.formatCurrency ? ctx.formatCurrency(Number(value) || 0) : String(value || 0);
  }

  function percent(value) {
    const number = Number(value) || 0;
    return number.toFixed(number % 1 ? 1 : 0).replace('.', ',') + '%';
  }

  function confidence(value) {
    return Math.round((Number(value) || 0) * 100) + '%';
  }

  function monthLabel(month) {
    return String(month || '').replace('/', '/');
  }

  function signalView(signal) {
    const metrics = signal?.metrics || {};
    const evidence = signal?.evidence || {};
    const period = signal?.period || {};
    const entity = signal?.entity || {};

    if (signal?.type === 'above_average') {
      return {
        title: 'Gastos acima da média recente',
        text: money(metrics.current) + ' no período, ' + money(metrics.deltaAmount) +
          ' acima da média dos meses anteriores (+' + percent(metrics.deltaPercent) + ').',
        details: [
          ['Média usada', money(metrics.baseline)],
          ['Base', (evidence.baselineSamples || period.baselineMonths?.length || 0) + ' meses'],
          ['Comparação', evidence.periodDay ? 'até o dia ' + evidence.periodDay : 'mês completo'],
          ['Confiança', confidence(signal.confidence)]
        ]
      };
    }

    if (signal?.type === 'possible_duplicate') {
      return {
        title: 'Possível lançamento duplicado',
        text: (entity.description || 'Este gasto') + ' aparece ' + (metrics.count || 2) +
          ' vezes com o mesmo valor de ' + money(metrics.value) + '.',
        details: [
          ['Data', evidence.sameDate || '—'],
          ['Responsável', evidence.sameUser || '—'],
          ['Pagamento', evidence.samePayment || '—'],
          ['Confiança', confidence(signal.confidence)]
        ]
      };
    }

    if (signal?.type === 'missing_recurring') {
      return {
        title: (entity.description || 'Gasto recorrente') + ' ainda não apareceu',
        text: 'Vencimento no dia ' + (metrics.dueDay || '—') + '. O lançamento esperado é de ' +
          money(metrics.expectedValue) + '.',
        details: [
          ['Atraso', (metrics.overdueDays || 0) + ((metrics.overdueDays || 0) === 1 ? ' dia' : ' dias')],
          ['Categoria', entity.category || 'Outros'],
          ['Situação', 'Não localizado nos lançamentos do mês'],
          ['Confiança', confidence(signal.confidence)]
        ]
      };
    }

    if (signal?.type === 'category_growth') {
      return {
        title: (entity.category || 'Categoria') + ' cresceu neste mês',
        text: money(metrics.current) + ' contra ' + money(metrics.baseline) +
          ' no período anterior: +' + money(metrics.deltaAmount) + ' (+' + percent(metrics.deltaPercent) + ').',
        details: [
          ['Categoria', entity.category || 'Outros'],
          ['Base', period.baselineMonths?.[0] ? monthLabel(period.baselineMonths[0]) : 'mês anterior'],
          ['Comparação', evidence.periodDay ? 'até o dia ' + evidence.periodDay : 'mês completo'],
          ['Confiança', confidence(signal.confidence)]
        ]
      };
    }

    return {
      title: 'Comportamento financeiro relevante',
      text: 'Foi identificado um sinal que merece revisão.',
      details: [['Confiança', confidence(signal?.confidence)]]
    };
  }

  function toggleDetails(button, details) {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    details.hidden = open;
    const label = button.querySelector('.behavior-insight__toggle-label');
    if (label) label.textContent = open ? 'Ver detalhes' : 'Ocultar';
  }

  function renderSignal(signal) {
    const view = signalView(signal);
    const article = document.createElement('article');
    article.className = 'behavior-insight behavior-insight--' + (signal.severity || 'medium');
    article.dataset.signalType = signal.type || 'unknown';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'behavior-insight__summary';
    button.setAttribute('aria-expanded', 'false');

    const marker = document.createElement('span');
    marker.className = 'behavior-insight__marker';
    marker.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'behavior-insight__copy';

    const title = document.createElement('strong');
    title.textContent = view.title;
    const text = document.createElement('span');
    text.textContent = view.text;
    copy.append(title, text);

    const toggle = document.createElement('span');
    toggle.className = 'behavior-insight__toggle-label';
    toggle.textContent = 'Ver detalhes';

    button.append(marker, copy, toggle);

    const details = document.createElement('div');
    details.className = 'behavior-insight__details';
    details.hidden = true;

    const dl = document.createElement('dl');
    view.details.forEach(([label, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      row.append(dt, dd);
      dl.appendChild(row);
    });
    details.appendChild(dl);

    button.addEventListener('click', () => toggleDetails(button, details));
    article.append(button, details);
    return article;
  }

  function render() {
    const box = document.getElementById('insightsLista');
    const count = document.getElementById('insightsCount');
    if (!box) return;

    const result = ctx?.getBehaviorResult?.() || { signals: [] };
    lastItems = Array.isArray(result.signals) ? result.signals.slice(0, 4) : [];

    box.innerHTML = '';

    if (count) {
      count.textContent = lastItems.length
        ? lastItems.length + (lastItems.length === 1 ? ' sinal' : ' sinais')
        : 'Sem sinais';
    }

    if (!lastItems.length) {
      const empty = document.createElement('div');
      empty.className = 'behavior-insight-empty';
      const title = document.createElement('strong');
      title.textContent = 'Nada fora do padrão relevante';
      const text = document.createElement('span');
      text.textContent = 'O motor não encontrou variações fortes com a base disponível.';
      empty.append(title, text);
      box.appendChild(empty);
      return;
    }

    lastItems.forEach(signal => box.appendChild(renderSignal(signal)));
  }

  function shareText() {
    if (!lastItems.length) return '';
    const lines = lastItems.slice(0, 3).map(signal => {
      const view = signalView(signal);
      return '• ' + view.title + ': ' + view.text;
    });
    return '\n🔎 *Sinais do mês:*\n' + lines.join('\n') + '\n';
  }

  window.GastosInsights = {
    init,
    render,
    shareText,
    signalView
  };
})();