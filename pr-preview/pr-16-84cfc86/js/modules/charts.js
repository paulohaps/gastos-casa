(function () {
  'use strict';
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function group(expenses, field) {
    const groups = new Map();
    for (const expense of expenses || []) {
      const value = Number(expense.valor);
      if (!Number.isFinite(value) || value <= 0) continue;
      const key = String(expense[field] || (field === 'usuario' ? 'Pessoa não informada' : 'Outros'));
      if (!groups.has(key)) groups.set(key, { label: key, total: 0, items: [] });
      const bucket = groups.get(key);
      bucket.total += value;
      bucket.items.push(expense);
    }
    return [...groups.values()].sort((a, b) => b.total - a.total);
  }
  function showDetails(bucket, context) {
    const el = id => document.getElementById(id);
    el('chartDetailsTitle').textContent = bucket.label;
    el('chartDetailsContext').textContent = context;
    el('chartDetailsTotal').textContent = money(bucket.total);
    el('chartDetailsCount').textContent = bucket.items.length + (bucket.items.length === 1 ? ' lançamento' : ' lançamentos');
    const list = el('chartDetailsList'); list.replaceChildren();
    const dateKey = item => /^\d{2}\/\d{2}\/\d{4}$/.test(item.data || '') ? item.data.split('/').reverse().join('-') : item.data || '';
    [...bucket.items].sort((a, b) => dateKey(b).localeCompare(dateKey(a))).forEach(item => {
      const row = document.createElement('article'); row.className = 'drill-row';
      const copy = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.descricao || 'Gasto';
      const meta = document.createElement('span');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(item.data || '') ? item.data.split('-').reverse().join('/') : item.data;
      meta.textContent = [date, item.categoria, item.usuario].filter(Boolean).join(' · ');
      const value = document.createElement('strong'); value.textContent = money(item.valor);
      copy.append(title, meta); row.append(copy, value); list.appendChild(row);
    });
    window.AppUI.openModal('chartDetailsDialog', '[data-modal-close]');
  }
  function render(target, { expenses = [], field = 'categoria', context = '' } = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) return;
    container.replaceChildren();
    const buckets = group(expenses, field);
    const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
    if (!total) {
      const empty = document.createElement('p'); empty.className = 'supporting-text';
      empty.textContent = 'Os gráficos aparecem quando houver gastos neste período.';
      container.appendChild(empty); return;
    }
    buckets.forEach((bucket, index) => {
      const percent = bucket.total / total * 100;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'explore-bar';
      button.setAttribute('aria-label', `${bucket.label}: ${money(bucket.total)}, ${percent.toFixed(1).replace('.', ',')}% dos gastos. Ver ${bucket.items.length} lançamentos.`);
      const head = document.createElement('span'); head.className = 'explore-bar__head';
      const label = document.createElement('strong'); label.textContent = bucket.label;
      const value = document.createElement('span'); value.textContent = money(bucket.total);
      head.append(label, value);
      const track = document.createElement('span'); track.className = 'explore-bar__track'; track.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span'); fill.style.width = percent + '%'; fill.dataset.color = index % 5; track.appendChild(fill);
      const foot = document.createElement('span'); foot.className = 'explore-bar__meta';
      foot.textContent = `${percent.toFixed(1).replace('.', ',')}% do total · ${bucket.items.length} ${bucket.items.length === 1 ? 'gasto' : 'gastos'} · Ver detalhes →`;
      button.append(head, track, foot); button.onclick = () => showDetails(bucket, context); container.appendChild(button);
    });
  }
  // Remove os lançamentos do detalhamento após o fechamento.
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chartDetailsDialog')?.addEventListener('close', () => document.getElementById('chartDetailsList').replaceChildren());
    window.addEventListener('gastos:viewchange', () => window.AppUI.closeModal('chartDetailsDialog'));
  });
  window.GastosCharts = { render };
})();
