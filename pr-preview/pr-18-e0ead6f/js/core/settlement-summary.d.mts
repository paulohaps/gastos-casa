export type SettlementSummary = {
  owner: string;
  otherPerson: string;
  payableCents: number;
  receivableCents: number;
  responsibilityCents: number;
  otherResponsibilityCents: number;
  balances: { month: string; method: string; direction: "payable" | "receivable" | "settled"; amountCents: number; debtor: string | null; creditor: string | null }[];
};
export function settlementSummary(expenses: { data: string; valor: number | string; usuario?: string; formaPagamento?: string }[], payments: { competencia: string; valor: number | string; pagador: string; recebedor: string; formaPagamento?: string }[], options: { owner: string; months: string[] }): SettlementSummary;
