import {
  belongsToMonth,
  totalCents,
  cents,
} from "../../../js/core/financial-selection.mjs";
import { formatCurrency } from "../../shared/finance/currency";
import { parseWallets, parseExpenses } from "../wallets/contracts";
import type { WalletApi } from "../wallets/contracts";
import type { FinancialRow } from "../../../js/core/financial-selection.mjs";
import type { DashboardSources, OverviewState } from "./types";
import { createFilterStore } from "./filters";
export type SharedExpense = Omit<FinancialRow, "scope"> & { usuario: string };
export type OverviewPorts = {
  api: WalletApi;
  getCurrentExpenses(): SharedExpense[];
  getBehaviorResult(): { signals: unknown[] } | null;
  getSelectedMonth(): string;
  getDashboardSources(): DashboardSources;
  getOwner(): string;
  getStatus(): string;
  showToast(message: string, error?: boolean): void;
};
export function createOverviewController() {
  let ports: OverviewPorts,
    request: AbortController | null = null;
  const listeners = new Set<() => void>();
  const filters = createFilterStore();
  let snapshot: OverviewState = {
    phase: "loading",
    expenses: [],
    personal: [],
    personalPhase: "loading",
    period: "",
    owner: "",
    walletName: "Meu cofre",
    walletValue: "—",
    walletNote: "Consultando seu cofre",
    history: [],
    personalHistory: [],
    budgets: null,
    payments: null,
    attention: 0,
    radarAvailable: false,
  };
  const publish = (next: Partial<OverviewState>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };
  const iso = (month: string) => month.split("/").reverse().join("-");
  async function personalSummary() {
    request?.abort();
    const active = new AbortController();
    request = active;
    const month = iso(ports.getSelectedMonth());
    publish({
      personalPhase: "loading",
      personal: [],
      personalHistory: [],
      walletValue: "—",
      walletNote: "Consultando seu cofre",
    });
    try {
      const wallets = parseWallets(
        await ports.api.fetchWallets({ signal: active.signal }),
      );
      active.signal.throwIfAborted();
      if (!wallets.length) {
        publish({
          personalPhase: "empty" as const,
          walletName: "Meu cofre",
          walletValue: "Seu cofre",
          walletNote: "Crie uma carteira e escolha um limite mensal.",
        });
        return;
      }
      const wallet =
        wallets.find(
          (item) => item.id === window.GastosWallets?.selectedWallet(),
        ) || wallets[0]!;
      const data = parseExpenses(
        await ports.api.fetchWalletExpenses(wallet.id, month, {
          signal: active.signal,
        }),
        month,
      );
      active.signal.throwIfAborted();
      totalCents(data.expenses);
      if (data.plan.remaining !== null) cents(data.plan.remaining);
      publish({
        personalPhase: data.expenses.length ? "success" : ("empty" as const),
        personal: data.expenses.map((row) => ({ ...row, scope: "personal" })),
        walletName: wallet.nome,
        walletValue:
          data.plan.remaining === null
            ? "Sem limite"
            : formatCurrency(data.plan.remaining),
        walletNote:
          wallet.nome +
          " · " +
          ports.getSelectedMonth() +
          " · limite atual, não saldo bancário",
      });
      const history = snapshot.history.filter((row) => row.month !== month);
      const results = await Promise.allSettled(
        history.map(async (row) => {
          const data = parseExpenses(
            await ports.api.fetchWalletExpenses(wallet.id, row.month, {
              signal: active.signal,
            }),
            row.month,
          );
          return data.expenses.map((item) => ({
            ...item,
            scope: "personal" as const,
          }));
        }),
      );
      active.signal.throwIfAborted();
      publish({
        personalHistory: history.map((row, index) => {
          const result = results[index]!;
          return {
            month: row.month,
            phase:
              result.status === "fulfilled"
                ? result.value.length
                  ? ("success" as const)
                  : "empty"
                : "error",
            rows: result.status === "fulfilled" ? result.value : [],
          };
        }),
      });
    } catch {
      if (!active.signal.aborted)
        publish({
          personalPhase: "error",
          personal: [],
          personalHistory: [],
          walletValue: "Indisponível",
          walletNote: "Não foi possível consultar seu cofre. Tente novamente.",
        });
    }
  }
  function renderHome() {
    const expenses = ports.getCurrentExpenses();
    const source = ports.getDashboardSources();
    const period = ports.getSelectedMonth();
    publish({
      phase:
        expenses.length >= 1000 || !belongsToMonth(expenses, iso(period))
          ? ("error" as const)
          : expenses.length
            ? ("success" as const)
            : ("empty" as const),
      expenses: expenses.map((row) => ({ ...row, scope: "house" })),
      owner: ports.getOwner(),
      period,
      attention: ports.getBehaviorResult()?.signals.length || 0,
      radarAvailable:
        source.radarAvailable &&
        source.history.every(
          (row) =>
            row.expenses !== null &&
            belongsToMonth(row.expenses, iso(row.month)),
        ),
      budgets: source.budgets,
      payments: source.payments,
      history: [
        ...source.history.map((row) => ({
          month: iso(row.month),
          phase:
            row.expenses === null ||
            row.expenses.length >= 1000 ||
            !belongsToMonth(row.expenses, iso(row.month))
              ? ("error" as const)
              : row.expenses.length
                ? ("success" as const)
                : ("empty" as const),
          rows: (row.expenses || []).map((item) => ({
            ...item,
            scope: "house" as const,
          })),
        })),
        {
          month: iso(period),
          phase:
            expenses.length >= 1000 || !belongsToMonth(expenses, iso(period))
              ? ("error" as const)
              : expenses.length
                ? ("success" as const)
                : ("empty" as const),
          rows: expenses.map((item) => ({ ...item, scope: "house" as const })),
        },
      ].sort((a, b) => a.month.localeCompare(b.month)),
    });
    void personalSummary();
  }
  function invalidate() {
    request?.abort();
    filters.reset();
    publish({
      phase: ports.getStatus() === "error" ? "error" : "loading",
      expenses: [],
      personal: [],
      history: [],
      personalHistory: [],
      budgets: null,
      payments: null,
      personalPhase: "loading",
      attention: 0,
      radarAvailable: false,
      owner: "",
      period: ports.getSelectedMonth(),
      walletValue: "—",
      walletNote: "",
    });
  }
  function init(options: OverviewPorts) {
    ports = options;
    window.addEventListener("gastos:viewchange", (event) => {
      if (
        (event as CustomEvent<{ view: string }>).detail.view === "resumo" &&
        snapshot.phase !== "loading" &&
        snapshot.phase !== "error"
      )
        void personalSummary();
    });
    window.addEventListener("gastos:sessioncleared", invalidate);
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-entry-open]")) {
        window.AppUI.openModal("entryChoiceDialog");
        return;
      }
      const target = event.target.closest<HTMLElement>("[data-entry-target]");
      if (!target) return;
      window.AppUI.closeModal("entryChoiceDialog");
      if (target.dataset.entryTarget === "carteiras") {
        window.GastosNavigation.show("carteiras");
        void window.GastosWallets.beginExpense().catch(() =>
          ports.showToast(
            "Não foi possível abrir seu cofre. Tente novamente.",
            true,
          ),
        );
      } else window.GastosNavigation.show("lancar");
    });
    document
      .getElementById("entryChoiceClose")
      ?.addEventListener("click", () =>
        window.AppUI.closeModal("entryChoiceDialog"),
      );
  }
  return {
    init,
    renderHome,
    invalidate,
    retryPersonal: personalSummary,
    filters,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type OverviewController = ReturnType<typeof createOverviewController>;
