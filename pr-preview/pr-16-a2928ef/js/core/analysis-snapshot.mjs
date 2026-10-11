import { analysisPeriod } from './analysis-period.mjs';
const record = value => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Validate the deterministic card, both on persistence and at the UI boundary. */
export function parseAnalysis(value) {
  if (!record(value) || typeof value.startMonth !== 'string' || typeof value.endMonth !== 'string' || !Array.isArray(value.months)) throw new Error('Resumo do período inválido.');
  const period = analysisPeriod({ startMonth: value.startMonth, month: value.endMonth });
  if (value.months.length !== period.months.length) throw new Error('Resumo do período incompleto.');
  const validTotal = total => typeof total === 'number' && Number.isFinite(total) && total >= 0 && Number.isSafeInteger(Math.round(total * 100));
  const validCount = count => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
  const months = value.months.map((row, index) => {
    if (!record(row) || row.month !== period.months[index] || !validTotal(row.total) || !validCount(row.count)) throw new Error('Resumo mensal inválido.');
    return { month: row.month, total: row.total, count: row.count };
  });
  const cents = months.reduce((sum, row) => sum + Math.round(row.total * 100), 0);
  if (!validTotal(value.total) || !validCount(value.count) || !Number.isSafeInteger(cents) || cents !== Math.round(value.total * 100) || months.reduce((sum, row) => sum + row.count, 0) !== value.count) throw new Error('Totais do período inconsistentes.');
  return { startMonth: value.startMonth, endMonth: value.endMonth, total: value.total, count: value.count, months };
}
