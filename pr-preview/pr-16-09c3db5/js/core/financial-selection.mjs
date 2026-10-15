/** Exact cents for read-only dashboard selectors. No legacy balance mutation. */
export function cents(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('INVALID_MONEY');
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('INVALID_MONEY');
  return result;
}
export function totalCents(rows) {
  let result = 0;
  for (const row of rows) { result += cents(row.valor); if (!Number.isSafeInteger(result)) throw new Error('INVALID_MONEY'); }
  return result;
}
export function selectExpenses(rows, filters) {
  return rows.filter(row =>
    (!filters.category || row.categoria === filters.category) &&
    (filters.type === 'all' || row.scope === filters.type) &&
    (!filters.person || (row.scope === 'house' && row.usuario === filters.person)) &&
    (!filters.method || (row.scope === 'house' && row.formaPagamento === filters.method)) &&
    (!filters.query || (row.descricao + ' ' + row.categoria).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(filters.query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()))
  );
}
export function safeTotal(rows) {
  try { return totalCents(rows); } catch { return null; }
}
export function belongsToMonth(rows, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  return rows.every(row => {
    const date = String(row.data || '');
    const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(date) ? date.split('/').reverse().join('-') : date;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso.slice(0,7) === month;
  });
}
