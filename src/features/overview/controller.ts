import { formatCurrency } from "../../shared/finance/currency";
import { parseWallets, parseExpenses } from "../wallets/contracts";
import type { Expense, WalletApi } from "../wallets/contracts";
export type SharedExpense = Expense & { usuario: string };
export type OverviewPorts = {
  api: WalletApi;
  getCurrentExpenses(): SharedExpense[];
  getBehaviorResult(): { signals: unknown[] } | null;
  getSelectedMonth(): string;
  totalize(expenses: SharedExpense[]): number;
  showToast(message: string, error?: boolean): void;
};
export function createOverviewController() {
  let ports: OverviewPorts,
    request: AbortController | null = null;
  const listeners = new Set<() => void>();
  let snapshot = {
    expenses: [] as SharedExpense[],
    total: null as number | null,
    attention: 0,
    period: "",
    walletValue: "—",
    walletNote: "Consultando seu cofre",
  };
  const publish = (next: Partial<typeof snapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };
  async function personalSummary() {
    request?.abort();
    const active = new AbortController();
    request = active;
    const month = ports.getSelectedMonth().split("/").reverse().join("-");
    publish({ walletValue: "—", walletNote: "Consultando seu cofre" });
    try {
      const wallets = parseWallets(
        await ports.api.fetchWallets({ signal: active.signal }),
      );
      active.signal.throwIfAborted();
      if (!wallets.length) {
        publish({
          walletValue: "Seu cofre",
          walletNote: "Crie uma carteira e escolha um limite mensal.",
        });
        return;
      }
      const wallet =
        wallets.find(
          (wallet) => wallet.id === window.GastosWallets?.selectedWallet(),
        ) || wallets[0]!;
      const data = parseExpenses(
        await ports.api.fetchWalletExpenses(wallet.id, month, {
          signal: active.signal,
        }),
        month,
      );
      active.signal.throwIfAborted();
      publish({
        walletValue:
          data.plan.remaining === null
            ? "Sem limite"
            : formatCurrency(data.plan.remaining),
        walletNote:
          wallet.nome +
          " · " +
          month.split("-").reverse().join("/") +
          " · orçamento pessoal",
      });
    } catch {
      if (!active.signal.aborted)
        publish({
          walletValue: "Indisponível",
          walletNote: "Abra seu cofre para consultar novamente.",
        });
    }
  }
  function renderHome() {
    const expenses = ports.getCurrentExpenses();
    publish({
      expenses: [...expenses],
      total: ports.totalize(expenses),
      attention: ports.getBehaviorResult()?.signals.length || 0,
      period: "Casa · " + ports.getSelectedMonth(),
    });
    void personalSummary();
  }
  function invalidate() {
    request?.abort();
    publish({
      expenses: [],
      total: null,
      attention: 0,
      period: "Casa · " + ports.getSelectedMonth(),
      walletValue: "—",
      walletNote: "",
    });
  }
  function init(options: OverviewPorts) {
    ports = options;
    window.addEventListener("gastos:viewchange", (event) => {
      if ((event as CustomEvent<{ view: string }>).detail.view === "resumo")
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
