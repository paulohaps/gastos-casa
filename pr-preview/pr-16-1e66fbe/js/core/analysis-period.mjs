/** Shared calendar validation; a single month keeps its existing history key. */
export function monthOrdinal(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new Error('INVALID_CONTEXT');
  const [year, month] = value.split('-').map(Number);
  if (year < 1) throw new Error('INVALID_CONTEXT');
  return year * 12 + month - 1;
}
export function shiftMonth(month, offset) {
  const ordinal = monthOrdinal(month) + offset;
  if (!Number.isInteger(offset) || ordinal < 12 || ordinal > 119999)
    throw new Error('INVALID_CONTEXT');
  return String(Math.floor(ordinal / 12)).padStart(4, '0') + '-' + String(ordinal % 12 + 1).padStart(2, '0');
}
export function analysisPeriod(context) {
  const end = monthOrdinal(context?.month);
  const first = context?.startMonth === undefined ? context.month : context.startMonth;
  const start = monthOrdinal(first);
  if (start > end || end - start >= 12) throw new Error('INVALID_CONTEXT');
  return {
    startMonth: first,
    endMonth: context.month,
    months: Array.from({ length: end - start + 1 }, (_, i) => shiftMonth(first, i)),
  };
}
export function periodLabel(context) {
  const period = analysisPeriod(context);
  const format = month => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'));
  return period.months.length === 1 ? format(period.endMonth) : format(period.startMonth) + ' — ' + format(period.endMonth);
}
