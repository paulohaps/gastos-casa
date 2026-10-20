export type ExpenseIntelligence = {
  version: string;
  scope: string;
  evidence: "descriptive" | "insufficient";
  recordCount: number;
  observedDays: number;
  totalCents: number;
  concentration: {
    category: string;
    totalCents: number;
    count: number;
    percent: number;
  } | null;
  unusualExpenses: {
    description: string;
    date: string;
    category: string;
    amountCents: number;
    medianReferenceCents: number;
    referenceCount: number;
    rule: string;
  }[];
  recurringCandidates: {
    description: string;
    category: string;
    observedMonths: number;
    referenceCents: number;
    evidence: "candidate";
    rule: string;
  }[];
  coverage: string;
};
export function expenseIntelligence(options: {
  current: {
    data: string;
    valor: number | string;
    categoria: string;
    descricao?: string;
    scope?: string;
  }[];
  previous?: {
    data: string;
    valor: number | string;
    categoria: string;
    descricao?: string;
    scope?: string;
  }[];
  context: { scope: string; month: string; startMonth?: string };
  today: string;
  baselineComplete?: boolean;
}): ExpenseIntelligence;
