(function () {
  'use strict';

  const DEFAULT_CATEGORIES = ['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'];

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  }

  function escapeHTML(value) {
    return value ? value.toString().replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag)) : '';
  }

  function extractMonthFromIso(dateString) {
    if (!dateString) return null;
    const parts = String(dateString).split('-');
    return parts.length === 3 ? parts[1] + '/' + parts[0] : null;
  }

  function previousMonth(month) {
    if (!month || !month.includes('/')) return month;
    const parts = month.split('/');
    let mm = Number(parts[0]);
    let yyyy = Number(parts[1]);
    mm -= 1;
    if (mm < 1) { mm = 12; yyyy -= 1; }
    return String(mm).padStart(2, '0') + '/' + yyyy;
  }

  function normalizeText(value) {
    return (value || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function totalize(items) {
    return (items || []).reduce((total, item) => total + (Number(item && item.valor) || 0), 0);
  }

  function totalsByCategory(items, categories) {
    categories = categories || DEFAULT_CATEGORIES;
    const totals = {};
    categories.forEach(category => { totals[category] = 0; });
    (items || []).forEach(item => {
      const category = categories.includes(item && item.categoria) ? item.categoria : 'Outros';
      totals[category] = (totals[category] || 0) + (Number(item && item.valor) || 0);
    });
    return totals;
  }

  window.GastosUtils = Object.freeze({
    DEFAULT_CATEGORIES,
    formatCurrency,
    escapeHTML,
    extractMonthFromIso,
    previousMonth,
    normalizeText,
    totalize,
    totalsByCategory
  });
})();