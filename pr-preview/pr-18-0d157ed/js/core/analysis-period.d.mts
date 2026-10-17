export function monthOrdinal(value: unknown): number;
export function shiftMonth(month: string, offset: number): string;
export function analysisPeriod(context: { month: string; startMonth?: string }): { startMonth: string; endMonth: string; months: string[] };
export function periodLabel(context: { month: string; startMonth?: string }): string;
