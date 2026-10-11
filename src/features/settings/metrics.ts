import { record } from "./contracts.ts";
const fields = ["value", "description", "category", "payment", "date"] as const;
export function parseMetrics(value: unknown) {
  const data = record(value);
  const count = (value: unknown) => {
    const number = Number(value);
    if (
      value === null ||
      value === undefined ||
      !Number.isSafeInteger(number) ||
      number < 0
    )
      throw new Error("Métricas incompletas. Tente novamente.");
    return number;
  };
  const rate = (value: unknown) => {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 100)
      throw new Error("Percentual inválido. Tente novamente.");
    return number;
  };
  const corrections = record(data.corrections),
    impact = record(data.learningImpact);
  const seconds =
    data.avgConfirmSeconds === null ? null : Number(data.avgConfirmSeconds);
  if (seconds !== null && (!Number.isFinite(seconds) || seconds < 0))
    throw new Error("Tempo inválido. Tente novamente.");
  const improvement =
    impact.improvementPp === null || impact.improvementPp === undefined
      ? null
      : Number(impact.improvementPp);
  if (
    improvement !== null &&
    (!Number.isFinite(improvement) || Math.abs(improvement) > 100)
  )
    throw new Error("Comparação inválida. Tente novamente.");
  return {
    days: count(data.days),
    interpretations: count(data.interpretations),
    expenseInterpretations: count(data.expenseInterpretations),
    unsupported: count(data.unsupported),
    confirmed: count(data.confirmed),
    unconfirmed: count(data.unconfirmed),
    confirmationRate: rate(data.confirmationRate),
    noCorrection: count(data.noCorrection),
    noCorrectionRate: rate(data.noCorrectionRate),
    seconds,
    learningRecorded: count(data.learningRecorded),
    corrections: fields.map((key) => {
      const correction = record(corrections[key]);
      return {
        key,
        count: count(correction.count),
        rate: rate(correction.rate),
      };
    }),
    impact: {
      learned: count(impact.learnedConfirmed),
      baseline: count(impact.baselineConfirmed),
      learnedRate: rate(impact.learnedCategoryCorrectionRate),
      baselineRate: rate(impact.baselineCategoryCorrectionRate),
      improvement,
    },
  };
}
export type Metrics = ReturnType<typeof parseMetrics>;
export const percentage = (value: number | null) =>
  value === null ? "—" : value.toFixed(1).replace(".", ",") + "%";
export function duration(value: number | null) {
  if (value === null) return "—";
  const seconds = Math.round(value);
  return seconds < 60
    ? seconds + "s"
    : `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ""}`;
}
