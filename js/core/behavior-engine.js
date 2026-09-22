(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GastosBehaviorEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'behavior-v1';
  const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 };

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function roundPercent(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function expenseDay(item) {
    const match = String(item?.data || '').match(/^(\d{1,2})[\/.-]/);
    const day = match ? Number(match[1]) : null;
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null;
  }

  function samePeriod(expenses, dayLimit) {
    if (!Number.isFinite(Number(dayLimit)) || Number(dayLimit) >= 31) return Array.isArray(expenses) ? expenses : [];
    return (expenses || []).filter(item => {
      const day = expenseDay(item);
      return day === null || day <= Number(dayLimit);
    });
  }

  function totalize(expenses) {
    return (expenses || []).reduce((sum, item) => sum + money(item?.valor), 0);
  }

  function categoryTotals(expenses) {
    return (expenses || []).reduce((acc, item) => {
      const category = String(item?.categoria || 'Outros').trim() || 'Outros';
      acc[category] = (acc[category] || 0) + money(item?.valor);
      return acc;
    }, {});
  }

  function signalId(type, parts) {
    return [type].concat(parts || []).map(part => normalize(part) || String(part ?? '')).join(':');
  }

  function confidenceForBaseline(months) {
    if (months >= 3) return 0.92;
    if (months === 2) return 0.82;
    return 0.65;
  }

  function detectAboveAverage(context) {
    const history = context.historyMonths || [];
    if (history.length < 2) return [];

    const current = roundMoney(totalize(context.currentExpenses));
    const totals = history.map(entry =>
      roundMoney(totalize(samePeriod(entry.expenses, context.periodDay)))
    );
    const valid = totals.filter(value => Number.isFinite(value));
    if (valid.length < 2) return [];

    const baseline = roundMoney(valid.reduce((sum, value) => sum + value, 0) / valid.length);
    if (baseline <= 0) return [];

    const deltaAmount = roundMoney(current - baseline);
    const deltaPercent = roundPercent((deltaAmount / baseline) * 100);
    if (deltaAmount < 50 || deltaPercent < 30) return [];

    return [{
      id: signalId('above_average', ['month_total', context.currentMonth]),
      type: 'above_average',
      scope: 'month_total',
      severity: deltaPercent >= 60 || deltaAmount >= 300 ? 'high' : 'medium',
      confidence: confidenceForBaseline(valid.length),
      period: {
        currentMonth: context.currentMonth,
        baselineMonths: history.slice(0, valid.length).map(entry => entry.month)
      },
      metrics: {
        current,
        baseline,
        deltaAmount,
        deltaPercent
      },
      evidence: {
        baselineSamples: valid.length,
        periodDay: context.periodDay
      }
    }];
  }

  function duplicateKey(item) {
    const description = normalize(item?.descricao);
    const value = roundMoney(item?.valor).toFixed(2);
    const date = String(item?.data || '').trim();
    const user = normalize(item?.usuario);
    const payment = normalize(item?.formaPagamento || 'Dinheiro');
    if (!description || !date || Number(value) <= 0) return null;
    return [description, value, date, user, payment].join('|');
  }

  function detectDuplicates(context) {
    const groups = new Map();
    (context.currentExpenses || []).forEach(item => {
      const key = duplicateKey(item);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    const signals = [];
    groups.forEach(items => {
      if (items.length < 2) return;
      const first = items[0];
      signals.push({
        id: signalId('possible_duplicate', [
          first.descricao,
          first.valor,
          first.data,
          first.usuario,
          first.formaPagamento
        ]),
        type: 'possible_duplicate',
        scope: 'expense',
        severity: 'medium',
        confidence: 0.98,
        period: { currentMonth: context.currentMonth },
        entity: {
          description: first.descricao || '',
          category: first.categoria || 'Outros'
        },
        metrics: {
          value: roundMoney(first.valor),
          count: items.length
        },
        evidence: {
          expenseIds: items.map(item => item.id).filter(Boolean),
          sameDate: first.data || null,
          sameUser: first.usuario || null,
          samePayment: first.formaPagamento || 'Dinheiro'
        }
      });
    });
    return signals;
  }

  function recurringPosted(item, expenses) {
    const target = normalize(item?.descricao);
    if (!target) return false;
    return (expenses || []).some(expense => {
      const description = normalize(expense?.descricao);
      if (!description) return false;
      return description === target || description.includes(target) || target.includes(description);
    });
  }

  function detectMissingRecurring(context) {
    if (!context.isCurrentMonth) return [];
    const currentDay = Number(context.currentDay);
    if (!Number.isFinite(currentDay) || currentDay < 2) return [];

    return (context.recurring || [])
      .filter(item => item?.ativo !== false)
      .filter(item => {
        const dueDay = Number(item?.dia_vencimento ?? item?.diaVencimento);
        return Number.isFinite(dueDay) && dueDay >= 1 && dueDay < currentDay;
      })
      .filter(item => !recurringPosted(item, context.currentExpenses))
      .map(item => {
        const dueDay = Number(item?.dia_vencimento ?? item?.diaVencimento);
        const overdueDays = Math.max(1, currentDay - dueDay);
        return {
          id: signalId('missing_recurring', [item.id || item.descricao, context.currentMonth]),
          type: 'missing_recurring',
          scope: 'recurring',
          severity: overdueDays >= 7 ? 'high' : 'medium',
          confidence: 0.95,
          period: { currentMonth: context.currentMonth },
          entity: {
            id: item.id || null,
            description: item.descricao || '',
            category: item.categoria || 'Outros'
          },
          metrics: {
            expectedValue: roundMoney(item.valor),
            dueDay,
            overdueDays
          },
          evidence: {
            active: true,
            postedMatch: false
          }
        };
      });
  }

  function detectCategoryGrowth(context) {
    const previous = context.historyMonths?.[0];
    if (!previous) return [];

    const currentTotals = categoryTotals(context.currentExpenses);
    const previousTotals = categoryTotals(samePeriod(previous.expenses, context.periodDay));
    const categories = new Set([...Object.keys(currentTotals), ...Object.keys(previousTotals)]);
    const signals = [];

    categories.forEach(category => {
      const current = roundMoney(currentTotals[category] || 0);
      const baseline = roundMoney(previousTotals[category] || 0);
      if (baseline < 30 || current <= baseline) return;
      const deltaAmount = roundMoney(current - baseline);
      const deltaPercent = roundPercent((deltaAmount / baseline) * 100);
      if (deltaAmount < 40 || deltaPercent < 30) return;

      signals.push({
        id: signalId('category_growth', [category, context.currentMonth]),
        type: 'category_growth',
        scope: 'category',
        severity: deltaPercent >= 70 || deltaAmount >= 250 ? 'high' : 'medium',
        confidence: 0.9,
        period: {
          currentMonth: context.currentMonth,
          baselineMonths: [previous.month]
        },
        entity: { category },
        metrics: {
          current,
          baseline,
          deltaAmount,
          deltaPercent
        },
        evidence: {
          periodDay: context.periodDay
        }
      });
    });

    return signals
      .sort((a, b) => b.metrics.deltaAmount - a.metrics.deltaAmount)
      .slice(0, 2);
  }

  function sortSignals(signals) {
    return [...signals].sort((a, b) => {
      const severityDiff = (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
      if (severityDiff) return severityDiff;
      const confidenceDiff = Number(b.confidence || 0) - Number(a.confidence || 0);
      if (confidenceDiff) return confidenceDiff;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function analyze(input) {
    const context = {
      currentExpenses: Array.isArray(input?.currentExpenses) ? input.currentExpenses : [],
      historyMonths: Array.isArray(input?.historyMonths)
        ? input.historyMonths
            .filter(item => item && Array.isArray(item.expenses))
            .slice(0, 3)
        : [],
      recurring: Array.isArray(input?.recurring) ? input.recurring : [],
      currentMonth: String(input?.currentMonth || ''),
      currentDay: Number(input?.currentDay) || 31,
      isCurrentMonth: input?.isCurrentMonth === true
    };
    context.periodDay = context.isCurrentMonth ? Math.min(31, Math.max(1, context.currentDay)) : 31;

    const signals = sortSignals([
      ...detectAboveAverage(context),
      ...detectDuplicates(context),
      ...detectMissingRecurring(context),
      ...detectCategoryGrowth(context)
    ]);

    const byType = signals.reduce((acc, signal) => {
      acc[signal.type] = (acc[signal.type] || 0) + 1;
      return acc;
    }, {});

    return {
      version: VERSION,
      signals,
      summary: {
        total: signals.length,
        byType,
        highestSeverity: signals[0]?.severity || null
      },
      context: {
        currentMonth: context.currentMonth,
        baselineMonths: context.historyMonths.map(item => item.month),
        periodDay: context.periodDay
      }
    };
  }

  return Object.freeze({
    VERSION,
    analyze,
    detectAboveAverage,
    detectDuplicates,
    detectMissingRecurring,
    detectCategoryGrowth
  });
});
