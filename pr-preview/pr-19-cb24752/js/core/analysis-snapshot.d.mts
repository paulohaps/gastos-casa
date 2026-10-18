export type Analysis = { startMonth: string; endMonth: string; total: number; count: number; months: { month: string; total: number; count: number }[] };
export function parseAnalysis(value: unknown): Analysis;
