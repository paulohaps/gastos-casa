export type Expense = {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  categoria: string;
};
export type Goal = {
  name: string;
  target: number;
  reserve: number;
  deadline: string;
  month: string;
};
export type Wallet = {
  id: string;
  nome: string;
  limite_mensal: number;
  goal: Goal | null;
};
export type Plan = {
  month: string;
  spent: number;
  budget: number;
  remaining: number | null;
  daily: number | null;
  remainingDays: number;
  count: number;
  signals: { type: string; amount: number; action: string }[];
};
export type WalletState = {
  wallets: Wallet[];
  items: Expense[];
  selected: string;
  month: string;
  plan: Plan | null;
  aiConfigured: boolean;
  phase: "idle" | "loading" | "empty" | "success" | "error";
  status: string;
  explanation: string;
  explanationStatus: string;
};
export interface WalletApi {
  fetchWallets(options?: { signal?: AbortSignal }): Promise<unknown>;
  fetchWalletExpenses(
    id: string,
    month: string,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  saveWallet(payload: {
    action: string;
    id?: string;
    nome?: string;
    limiteMensal?: number;
  }): Promise<{ wallets: unknown }>;
  saveWalletExpense(payload: {
    action: string;
    id?: string | null;
    walletId: string;
    dataGasto?: string;
    valor?: number;
    descricao?: string;
    categoria?: string;
  }): Promise<unknown>;
  parseSmartEntry(text: string): Promise<{
    draft?: {
      data?: string;
      valor?: number;
      descricao?: string;
      categoria?: string;
    };
  }>;
  explainWallet(id: string, month: string): Promise<unknown>;
  saveWalletGoal(payload: {
    walletId: string;
    goal: Goal | null;
  }): Promise<unknown>;
}
export interface WalletPorts {
  api: WalletApi;
  ui: typeof window.AppUI;
  formatCurrency(value: number): string;
  showToast(message: string, error?: boolean): void;
}
declare global {
  interface Window {
    AppUI: {
      openModal(target: string | HTMLDialogElement, focus?: string): void;
      closeModal(target: string | HTMLDialogElement): void;
      setModalBusy(target: string | HTMLDialogElement, busy: boolean): void;
      confirmAction(options: {
        title: string;
        message: string;
        confirmLabel: string;
        variant?: string;
      }): Promise<boolean>;
    };
    GastosCharts: {
      render(
        id: string,
        options: { expenses: Expense[]; context: string },
      ): void;
    };
    GastosWalletPlanner: {
      forecast(
        plan: Plan | null,
      ): { projected: number; elapsed: number } | null;
      simulate(
        plan: Plan | null,
        amount: string | number,
        reserve: string | number,
      ): {
        afterPurchase: number;
        afterReserve: number;
        daily: number | null;
        exceeds: boolean;
        reserveCovered: boolean;
      } | null;
      protect(
        plan: Plan | null,
        goal: Goal | null,
      ): {
        reserve: number;
        available: number | null;
        daily: number | null;
        shortfall: number;
      };
    };
  }
}
const fail = () => {
  throw new Error("Dados do cofre incompletos. Tente novamente.");
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function money(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === "" ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0 ||
    Number(value) > 9999999999.99
  )
    return fail();
  return Number(value);
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return fail();
  return value;
}
export function parseWallets(value: unknown): Wallet[] {
  if (!Array.isArray(value)) return fail();
  return value.map((value) => {
    const row = record(value);
    const goal =
      row.goal_nome == null
        ? null
        : {
            name: text(row.goal_nome),
            target: money(row.goal_valor),
            reserve: money(row.goal_reserva),
            deadline: text(row.goal_prazo),
            month: text(row.goal_mes),
          };
    if (
      goal &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(goal.deadline) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(goal.month) ||
        goal.target <= 0 ||
        goal.reserve > goal.target)
    )
      return fail();
    return {
      id: text(row.id),
      nome: text(row.nome),
      limite_mensal: money(row.limite_mensal),
      goal,
    };
  });
}
export function parseExpenses(
  value: unknown,
  month: string,
): { expenses: Expense[]; plan: Plan; aiConfigured: boolean } {
  const data = record(value),
    raw = record(data.plan);
  if (
    !Array.isArray(data.expenses) ||
    !Array.isArray(raw.signals) ||
    (raw.month !== undefined && raw.month !== month)
  )
    return fail();
  const expenses = data.expenses.map((value) => {
    const row = record(value),
      date = text(row.data);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== month)
      return fail();
    return {
      id: text(row.id),
      data: date,
      valor: money(row.valor),
      descricao: text(row.descricao),
      categoria: text(row.categoria),
    };
  });
  const spent = money(raw.spent),
    budget = money(raw.budget);
  const sum =
    Math.round(
      expenses.reduce(
        (total, expense) => total + Math.round(expense.valor * 100),
        0,
      ),
    ) / 100;
  if (Math.abs(spent - sum) > 0.005) return fail();
  if (
    raw.remaining !== null &&
    ((typeof raw.remaining !== "number" && typeof raw.remaining !== "string") ||
      String(raw.remaining).trim() === "" ||
      !Number.isFinite(Number(raw.remaining)))
  )
    return fail();
  const expectedRemaining =
    budget > 0 ? Math.max(0, Math.round((budget - spent) * 100) / 100) : null;
  if (
    (expectedRemaining === null) !== (raw.remaining === null) ||
    (expectedRemaining !== null &&
      Math.abs(Math.max(0, Number(raw.remaining)) - expectedRemaining) > 0.005)
  )
    return fail();
  const plan: Plan = {
    month,
    spent,
    budget,
    remaining:
      raw.remaining === null ? null : Math.max(0, Number(raw.remaining)),
    daily: raw.daily === null ? null : money(raw.daily),
    remainingDays:
      raw.remainingDays === undefined ? 0 : money(raw.remainingDays),
    count: expenses.length,
    signals: raw.signals.map((value) => {
      const row = record(value);
      return {
        type: text(row.type),
        amount: money(row.amount),
        action: text(row.action),
      };
    }),
  };
  if (!Number.isFinite(plan.remaining) && plan.remaining !== null)
    return fail();
  return { expenses, plan, aiConfigured: data.aiConfigured === true };
}
export function parseExplanation(value: unknown) {
  const explanation = record(record(value).explanation);
  return {
    explanation: {
      text: text(explanation.text),
      source: text(explanation.source),
      reason: explanation.reason,
    },
  };
}
