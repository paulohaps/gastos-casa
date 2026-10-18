import { cents } from './financial-selection.mjs';
import { analysisPeriod, shiftMonth } from './analysis-period.mjs';
const labels = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export function spendingPatterns(rows, context, today) {
  const selected = analysisPeriod(context);
  const start = selected.startMonth + '-01', end = shiftMonth(selected.endMonth, 1) + '-01';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('DATA_UNAVAILABLE');
  const weekdays = labels.map((day, weekday) => ({ weekday, day, totalCents: 0, count: 0, calendarDays: 0, activeDays: 0 }));
  const monthDays = Array.from({ length: 31 }, (_, i) => ({ day: i + 1, totalCents: 0, count: 0, calendarDays: 0, activeDays: 0 }));
  for (let date = new Date(start + 'T00:00:00Z'); date.toISOString().slice(0, 10) < end && date.toISOString().slice(0, 10) <= today; date.setUTCDate(date.getUTCDate() + 1)) {
    weekdays[date.getUTCDay()].calendarDays++;
    monthDays[date.getUTCDate() - 1].calendarDays++;
  }
  const daily = new Map();
  for (const row of rows) {
    const date = new Date(row.data + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.data || row.data < start || row.data >= end) throw new Error('DATA_UNAVAILABLE');
    if (row.data > today) continue;
    const value = cents(row.valor);
    for (const bucket of [weekdays[date.getUTCDay()], monthDays[date.getUTCDate() - 1]]) {
      bucket.totalCents += value;
      bucket.count++;
      if (!Number.isSafeInteger(bucket.totalCents)) throw new Error('DATA_UNAVAILABLE');
    }
    const amount = (daily.get(row.data) || 0) + value;
    if (!Number.isSafeInteger(amount)) throw new Error('DATA_UNAVAILABLE');
    daily.set(row.data, amount);
  }
  for (const day of daily.keys()) {
    const date = new Date(day + 'T00:00:00Z');
    weekdays[date.getUTCDay()].activeDays++;
    monthDays[date.getUTCDate() - 1].activeDays++;
  }
  const summarize = buckets => buckets.map(bucket => ({ ...bucket, averagePerCalendarDayCents: bucket.calendarDays ? Math.round(bucket.totalCents / bucket.calendarDays) : null }));
  return {
    start, through: today < start ? null : today < end ? today : new Date(new Date(end + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10),
    distinctSpendingDays: daily.size,
    observedMonths: new Set([...daily.keys()].map(day => day.slice(0, 7))).size,
    evidence: daily.size < 6 ? 'insufficient' : 'descriptive',
    weekdays: summarize(weekdays), monthDays: summarize(monthDays),
    peakDays: [...daily].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([date, totalCents]) => ({ date, totalCents })),
    limitation: 'Somente lançamentos registrados até a data de corte. Médias por ocorrência no calendário, incluindo dias sem registros, arredondadas para exibição; não comprovam hábito nem previsão. Um único mês não comprova padrão mensal recorrente.',
  };
}
