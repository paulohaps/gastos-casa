import { cents } from "./financial-selection.mjs";
import { analysisPeriod, shiftMonth } from "./analysis-period.mjs";
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : sorted[middle - 1] +
        Math.round((sorted[middle] - sorted[middle - 1]) / 2);
};
const sum = (rows) =>
  rows.reduce((total, row) => {
    const next = total + row.amountCents;
    if (!Number.isSafeInteger(next)) throw new Error("DATA_UNAVAILABLE");
    return next;
  }, 0);
const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

// Explainable observations, never ledger entries, fraud verdicts or guaranteed forecasts.
export function expenseIntelligence({
  current,
  previous = [],
  context,
  today,
  baselineComplete = true,
}) {
  const selected = analysisPeriod(context);
  if (!validDate(today) || !Array.isArray(current) || !Array.isArray(previous))
    throw new Error("DATA_UNAVAILABLE");
  const prepare = (rows, start, end) =>
    rows
      .map((row) => {
        if (
          !validDate(row.data) ||
          row.data.slice(0, 7) < start ||
          row.data.slice(0, 7) > end ||
          typeof row.categoria !== "string"
        )
          throw new Error("DATA_UNAVAILABLE");
        return { ...row, amountCents: cents(row.valor) };
      })
      .filter((row) => row.data <= today);
  const rows = prepare(current, selected.startMonth, selected.endMonth);
  const baseline = prepare(
    previous,
    shiftMonth(selected.startMonth, -selected.months.length),
    shiftMonth(selected.startMonth, -1),
  );
  sum(baseline);
  const total = sum(rows),
    categories = new Map();
  for (const row of rows) {
    const list = categories.get(row.categoria) || [];
    list.push(row);
    categories.set(row.categoria, list);
  }
  const largest = [...categories]
    .map(([category, items]) => ({
      category,
      totalCents: sum(items),
      count: items.length,
    }))
    .sort((a, b) => b.totalCents - a.totalCents)[0];
  const unusualExpenses = [];
  for (const [category, items] of categories) {
    const sorted = items
      .filter((row) => row.amountCents > 0)
      .sort((a, b) => a.amountCents - b.amountCents);
    if (sorted.length < 6) continue;
    const peers = sorted.length - 1,
      middle = Math.floor(peers / 2);
    for (let index = 0; index < sorted.length; index++) {
      const row = sorted[index];
      if (row.amountCents < 1000) continue;
      // Leave this observation out without re-sorting the category per expense.
      const at = (k) => sorted[k + (k >= index ? 1 : 0)].amountCents;
      const reference =
        peers % 2
          ? at(middle)
          : at(middle - 1) + Math.round((at(middle) - at(middle - 1)) / 2);
      if (reference > 0 && row.amountCents >= reference * 3)
        unusualExpenses.push({
          description: String(row.descricao || "Despesa").slice(0, 100),
          date: row.data,
          category,
          amountCents: row.amountCents,
          medianReferenceCents: reference,
          referenceCount: peers,
          rule: "Pelo menos 3 vezes a mediana de 5 ou mais outros registros da mesma categoria; não prova erro ou fraude.",
        });
    }
  }
  const groups = new Map();
  for (const row of [...(baselineComplete ? baseline : []), ...rows]) {
    const name = normalize(row.descricao);
    if (name.length < 4 || row.amountCents <= 0) continue;
    const key = JSON.stringify([
      name,
      row.categoria,
      row.scope || context.scope,
    ]);
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  const recurringCandidates = [];
  for (const items of groups.values()) {
    const months = new Set(items.map((row) => row.data.slice(0, 7)));
    if (months.size < 3 || months.size !== items.length) continue;
    const ordered = [...months].sort();
    if (
      ordered.some(
        (month, index) =>
          index > 0 && shiftMonth(ordered[index - 1], 1) !== month,
      )
    )
      continue;
    const amounts = items.map((r) => r.amountCents),
      days = items.map((r) => Number(r.data.slice(8))),
      reference = median(amounts);
    if (
      Math.max(...days) - Math.min(...days) > 6 ||
      (Math.max(...amounts) - Math.min(...amounts)) / reference > 0.1
    )
      continue;
    recurringCandidates.push({
      description: String(items[0].descricao).slice(0, 100),
      category: items[0].categoria,
      observedMonths: months.size,
      referenceCents: reference,
      evidence: "candidate",
      rule: "Um lançamento por mês, em 3 ou mais meses, com variação de até 10% no valor e janela de 6 dias; confirme antes de criar recorrência.",
    });
  }
  const days = new Set(rows.map((r) => r.data)).size;
  return {
    version: "expense-intelligence-v1",
    scope: context.scope,
    evidence: days >= 6 && rows.length >= 8 ? "descriptive" : "insufficient",
    recordCount: rows.length,
    observedDays: days,
    totalCents: total,
    concentration:
      largest && total > 0
        ? {
            ...largest,
            percent: Math.round((largest.totalCents / total) * 1000) / 10,
          }
        : null,
    unusualExpenses: unusualExpenses
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 5),
    recurringCandidates: recurringCandidates.slice(0, 5),
    coverage:
      "Somente registros autorizados até a data de corte, no contexto selecionado. Ausência de registro não comprova ausência de gasto. Médias/medianas são referências descritivas, não valores de acerto. Não detecta pagamentos bancários.",
  };
}
