import type { FinancialRow } from "../../../js/core/financial-selection.mjs";
export type Phase = "loading" | "success" | "empty" | "error";
export type MonthRows = { month: string; phase: Phase; rows: FinancialRow[] };
export type Budget = { categoria: string; valor_limite: number | string };
export type Payment = {
  valor: number;
  pagador: string;
  recebedor: string;
  formaPagamento: string;
};
export type DashboardSources = {
  history: {
    month: string;
    expenses: (Omit<FinancialRow, "scope"> & { usuario: string })[] | null;
  }[];
  budgets: Budget[] | null;
  payments: Payment[] | null;
  radarAvailable: boolean;
};
export type OverviewState = {
  phase: Phase;
  period: string;
  owner: string;
  expenses: FinancialRow[];
  personal: FinancialRow[];
  personalPhase: Phase;
  walletName: string;
  walletValue: string;
  walletNote: string;
  history: MonthRows[];
  personalHistory: MonthRows[];
  budgets: Budget[] | null;
  payments: Payment[] | null;
  radarAvailable: boolean;
  attention: number;
};
