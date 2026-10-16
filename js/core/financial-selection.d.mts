export type FinancialRow = { id: string; data: string; valor: number; descricao: string; categoria: string; scope: "house" | "personal"; usuario?: string; formaPagamento?: string };
export type FinancialFilters = { category: string; person: string; method: string; type: "all" | "house" | "personal"; query: string };
export function cents(value: number | string): number;
export function totalCents(rows: { valor: number | string }[]): number;
export function safeTotal(rows: { valor: number | string }[]): number | null;
export function selectExpenses<T extends FinancialRow>(rows: T[], filters: FinancialFilters): T[];
export function belongsToMonth(rows: { data: string }[], month: string): boolean;
