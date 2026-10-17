import { localDate } from "../../../js/core/calendar.mjs";
import { parseWallets, parseExpenses, parseExplanation } from "./contracts";
import type {
  Wallet,
  Expense,
  Plan,
  WalletPorts,
  WalletState,
  Goal,
} from "./contracts";
const currentMonth = () => {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
};
const errorMessage = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "Não foi possível concluir. Tente novamente.";
export function createWalletController() {
  let ctx: WalletPorts;
  let wallets: Wallet[] = [],
    items: Expense[] = [],
    selected = "",
    selectedMonth = currentMonth(),
    plan: Plan | null = null,
    aiConfigured = false,
    generation = 0,
    expenseEdit: string | null = null,
    loading: Promise<void> | null = null,
    sessionVersion = 0;
  let phase: WalletState["phase"] = "idle",
    status = "Abra esta área para carregar suas carteiras.",
    explanation = "",
    explanationStatus = "";
  let request: AbortController | null = null;
  const listeners = new Set<() => void>();
  let snapshot: WalletState = {
    wallets,
    items,
    selected,
    month: selectedMonth,
    plan,
    aiConfigured,
    phase,
    status,
    explanation,
    explanationStatus,
  };

  function el<T extends HTMLElement = HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error("Controle ausente: " + id);
    return node as T;
  }
  const input = (id: string) => el<HTMLInputElement>(id);
  const form = (id: string) => el<HTMLFormElement>(id);

  const money = (n: number) => ctx.formatCurrency(Number(n) || 0);
  const month = () => selectedMonth;
  const wallet = () => wallets.find((w) => w.id === selected);
  async function write<T>(operation: Promise<T>): Promise<T> {
    const version = sessionVersion;
    const result = await operation;
    if (version !== sessionVersion) throw new Error("Sessão alterada.");
    return result;
  }
  function message(text: string, error = false) {
    status = text;
    render();
    if (error) {
      const status = document.querySelector<HTMLElement>(
        ".wallet-form-dialog[open] [data-wallet-status]",
      );
      if (status) status.textContent = text;
      else ctx.showToast(text, true);
    }
  }
  function openDialog(id: string) {
    el(id).querySelector<HTMLElement>("[data-wallet-status]")!.textContent = "";
    window.AppUI.openModal(id, 'input:not([type="hidden"])');
  }
  function openCreate() {
    openDialog("walletCreateDialog");
  }
  function openExpense() {
    if (!wallet()) return openCreate();
    el("walletExpenseContext").textContent = wallet()!.nome + " · só você";
    el("walletExpenseDialogTitle").textContent = expenseEdit
      ? "Editar gasto pessoal"
      : "Novo gasto pessoal";
    openDialog("walletExpenseDialog");
  }
  async function beginExpense() {
    const version = sessionVersion;
    await load();
    if (version !== sessionVersion || phase === "error") return;
    clearExpense();
    openExpense();
  }
  async function reviewText(text: string, walletId: string, period: string) {
    const version = sessionVersion;
    await load();
    if (version !== sessionVersion) throw new Error("Sessão alterada.");
    if (!wallets.some((item) => item.id === walletId))
      throw new Error("Esta carteira não está mais disponível.");
    const result = await ctx.api.parseSmartEntry(text);
    if (version !== sessionVersion) throw new Error("Sessão alterada.");
    const draft = result.draft;
    if (!draft) throw new Error("Não foi possível interpretar o gasto.");
    selected = walletId;
    selectedMonth = period;
    await loadExpenses();
    if (version !== sessionVersion) throw new Error("Sessão alterada.");
    clearExpense();
    input("walletExpenseDate").value = draft.data || "";
    input("walletExpenseValue").value = String(draft.valor || "");
    input("walletExpenseDescription").value = draft.descricao || text;
    input("walletExpenseCategory").value = draft.categoria || "Outros";
    openExpense();
  }
  function clearExpense() {
    expenseEdit = null;
    form("walletExpenseForm").reset();
    input("walletExpenseDate").valueAsDate = new Date();
    el("walletExpenseSubmit").textContent = "Salvar gasto pessoal";
    el("walletExpenseCancel").hidden = true;
  }
  function render() {
    snapshot = {
      wallets: [...wallets],
      items: [...items],
      selected,
      month: selectedMonth,
      plan,
      aiConfigured,
      phase,
      status,
      explanation,
      explanationStatus,
    };
    listeners.forEach((listener) => listener());
  }
  function simulatePurchase(event: SubmitEvent) {
    event.preventDefault();
    const result = el("walletSimulatorResult");
    result.replaceChildren();
    result.hidden = false;
    let scenario;
    try {
      scenario = window.GastosWalletPlanner.simulate(
        plan,
        input("walletSimulatorAmount").value,
        input("walletSimulatorReserve").value,
      );
    } catch (error) {
      result.textContent = errorMessage(error);
      return;
    }
    if (!scenario) {
      result.dataset.state = "warning";
      result.textContent =
        "Defina um limite mensal em Ajustar limite para avaliar esta compra. Sem esse limite, não há base para dizer quanto restaria.";
      return;
    }
    result.dataset.state =
      scenario.exceeds || !scenario.reserveCovered ? "warning" : "success";
    const title = document.createElement("strong");
    title.textContent = scenario.exceeds
      ? "A compra ultrapassa o limite em " + money(-scenario.afterPurchase)
      : !scenario.reserveCovered
        ? "A compra cabe, mas faltariam " +
          money(-scenario.afterReserve) +
          " para a reserva"
        : "A compra cabe no limite informado";
    const note = document.createElement("p");
    note.textContent =
      "Depois da compra: " +
      money(scenario.afterPurchase) +
      " de limite restante. " +
      (scenario.daily != null
        ? "Descontando a reserva, a referência seria " +
          money(scenario.daily) +
          " por dia até o fim do mês."
        : "Descontando a reserva: " + money(scenario.afterReserve) + ".");
    const caution = document.createElement("small");
    caution.textContent = "Confira outras despesas previstas antes de decidir.";
    result.append(title, note, caution);
  }
  async function loadExpenses() {
    request?.abort();
    request = new AbortController();
    const signal = request.signal;
    const turn = ++generation,
      id = selected,
      period = month();
    window.AppUI.closeModal("chartDetailsDialog");
    window.AppUI.closeModal("walletSimulatorDialog");
    items = [];
    plan = null;
    aiConfigured = false;
    explanation = "";
    explanationStatus = "";
    phase = "loading";
    render();
    if (!id || !period) {
      phase = "empty";
      render();
      return;
    }
    message("Carregando carteira...");
    try {
      const data = parseExpenses(
        await ctx.api.fetchWalletExpenses(id, period, { signal }),
        period,
      );
      if (turn !== generation) return;
      items = data.expenses;
      plan = data.plan;
      aiConfigured = data.aiConfigured;
      phase = items.length ? "success" : "empty";
      render();
      message("Visível apenas para você.");
    } catch (e) {
      if (turn === generation) {
        phase = "error";
        message(errorMessage(e), true);
      }
    }
  }
  function load() {
    if (loading) return loading;
    const request = loadWallets().finally(() => {
      if (loading === request) loading = null;
    });
    loading = request;
    return loading;
  }
  async function loadWallets() {
    const session = sessionVersion;
    items = [];
    plan = null;
    phase = "loading";
    message("Carregando carteiras...");
    try {
      const result = await ctx.api.fetchWallets();
      if (session !== sessionVersion) return;
      wallets = parseWallets(result);
      if (!wallets.some((w) => w.id === selected))
        selected = wallets[0]?.id || "";
      await loadExpenses();
      if (!wallets.length)
        message("Crie uma carteira para organizar seus gastos pessoais.");
    } catch (e) {
      if (session === sessionVersion) {
        items = [];
        plan = null;
        phase = "error";
        message(errorMessage(e), true);
      }
    }
  }
  function bindForm(id: string, action: () => Promise<void>) {
    form(id).addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = (event.submitter ||
        el(id).querySelector('[type="submit"]')) as HTMLButtonElement;
      if (button.disabled) return;
      const version = sessionVersion;
      button.disabled = true;
      const dialog = el(id).closest("dialog")!;
      window.AppUI.setModalBusy(dialog, true);
      try {
        await action();
      } catch (e) {
        if (version === sessionVersion)
          message(errorMessage(e) || "Não foi possível salvar.", true);
      } finally {
        button.disabled = false;
        window.AppUI.setModalBusy(dialog, false);
      }
    });
  }
  function init(options: WalletPorts) {
    ctx = options;
    clearExpense();
    document
      .querySelectorAll<HTMLButtonElement>("[data-wallet-close]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            window.AppUI.closeModal(button.dataset.walletClose!)),
      );
    el("walletExpenseCancel").onclick = () => {
      clearExpense();
      window.AppUI.closeModal("walletExpenseDialog");
    };
    form("walletSimulatorForm").addEventListener("submit", simulatePurchase);
    bindForm("walletCreateForm", async () => {
      const result = await write(
        ctx.api.saveWallet({
          action: "add",
          nome: input("walletName").value.trim(),
          limiteMensal: Number(input("walletLimit").value),
        }),
      );
      selected = parseWallets(result.wallets)[0]!.id;
      form("walletCreateForm").reset();
      window.AppUI.setModalBusy("walletCreateDialog", false);
      window.AppUI.closeModal("walletCreateDialog");
      await load();
    });
    bindForm("walletManageForm", async () => {
      await write(
        ctx.api.saveWallet({
          action: "update",
          id: selected,
          nome: input("walletManageName").value.trim(),
          limiteMensal: Number(input("walletManageLimit").value),
        }),
      );
      window.AppUI.setModalBusy("walletSettings", false);
      window.AppUI.closeModal("walletSettings");
      await load();
    });
    el("walletDelete").onclick = async () => {
      const id = selected;
      if (!id) return;
      window.AppUI.closeModal("walletSettings");
      if (
        !(await ctx.ui.confirmAction({
          title: "Excluir carteira vazia?",
          message:
            "Carteiras com lançamentos precisam ter os gastos removidos antes.",
          confirmLabel: "Excluir",
          variant: "danger",
        }))
      ) {
        openDialog("walletSettings");
        el("walletDelete").focus();
        return;
      }
      el<HTMLButtonElement>("walletDelete").disabled = true;
      try {
        await write(ctx.api.saveWallet({ action: "delete", id }));
        clearExpense();
        await load();
      } catch (e) {
        message(errorMessage(e), true);
      } finally {
        el<HTMLButtonElement>("walletDelete").disabled = false;
      }
    };
    bindForm("walletExpenseForm", async () => {
      if (!selected) throw new Error("Escolha uma carteira.");
      await write(
        ctx.api.saveWalletExpense({
          action: expenseEdit ? "update" : "add",
          id: expenseEdit,
          walletId: selected,
          dataGasto: input("walletExpenseDate").value,
          valor: Number(input("walletExpenseValue").value),
          descricao: input("walletExpenseDescription").value.trim(),
          categoria: input("walletExpenseCategory").value,
        }),
      );
      selectedMonth = input("walletExpenseDate").value.slice(0, 7);
      window.AppUI.setModalBusy("walletExpenseDialog", false);
      window.AppUI.closeModal("walletExpenseDialog");
      clearExpense();
      await loadExpenses();
    });
    let loaded = false;
    const maybeLoad = (view: string) => {
      if (view === "carteiras" && !loaded) {
        loaded = true;
        load();
      }
    };
    window.addEventListener("gastos:sessioncleared", () => {
      sessionVersion++;
      generation++;
      request?.abort();
      loaded = false;
      loading = null;
      phase = "idle";
      wallets = [];
      items = [];
      selected = "";
      plan = null;
      aiConfigured = false;
      [
        "walletSimulatorDialog",
        "walletExpenseDialog",
        "walletCreateDialog",
        "walletSettings",
        "chartDetailsDialog",
      ].forEach((id) => {
        window.AppUI.setModalBusy(id, false);
        window.AppUI.closeModal(id);
      });
      explanation = "";
      explanationStatus = "";
      el("walletSimulatorResult").replaceChildren();
      clearExpense();
      render();
      message("Entre para consultar seu cofre.");
    });
    window.addEventListener("gastos:authenticated", () =>
      maybeLoad(window.GastosNavigation.current()),
    );
    window.addEventListener("gastos:viewchange", (event) => {
      maybeLoad((event as CustomEvent<{ view: string }>).detail.view);
      if (
        (event as CustomEvent<{ view: string }>).detail.view !== "carteiras"
      ) {
        window.AppUI.closeModal("walletSimulatorDialog");
        window.AppUI.closeModal("walletExpenseDialog");
        window.AppUI.closeModal("walletCreateDialog");
        window.AppUI.closeModal("walletSettings");
      }
    });
    window.addEventListener("gastos:aichange", () => {
      if (selected) loadExpenses();
    });
    maybeLoad(window.GastosNavigation.current());
    render();
  }
  function openSimulator() {
    form("walletSimulatorForm").reset();
    input("walletSimulatorReserve").value = String(
      window.GastosWalletPlanner.protect(plan, wallet()?.goal || null).reserve,
    );
    el("walletSimulatorResult").hidden = true;
    el("walletSimulatorContext").textContent = wallet()!.nome + " · " + month();
    window.AppUI.openModal("walletSimulatorDialog", "#walletSimulatorAmount");
  }
  async function explain() {
    if (explanationStatus === "Preparando sua análise…") return;
    const turn = generation,
      id = selected,
      period = month();

    explanationStatus = "Preparando sua análise…";
    render();
    try {
      const data = parseExplanation(await ctx.api.explainWallet(id, period));
      if (turn !== generation) return;
      const answer = data.explanation;
      explanation = answer.text;
      explanationStatus =
        answer.source === "ai"
          ? "Explicação por IA · confira as sugestões antes de decidir."
          : answer.reason === "provider_unavailable"
            ? "O provedor não respondeu. Confira sua conexão em Ajustes. Mantivemos a recomendação automática."
            : answer.reason === "cooldown"
              ? "Aguarde um minuto para pedir outra análise. Esta recomendação foi calculada pelos seus gastos."
              : "Recomendação automática · baseada nos seus lançamentos.";
    } catch (e) {
      if (turn === generation) {
        explanationStatus = errorMessage(e);
        render();
      }
    } finally {
      if (turn === generation) render();
    }
  }

  function editLimit() {
    input("walletManageName").value = wallet()?.nome || "";
    input("walletManageLimit").value = String(wallet()?.limite_mensal || 0);
    openDialog("walletSettings");
    input("walletManageLimit").focus();
  }
  function editExpense(item: Expense) {
    expenseEdit = item.id;
    input("walletExpenseDate").value = item.data;
    input("walletExpenseValue").value = String(item.valor);
    input("walletExpenseDescription").value = item.descricao;
    input("walletExpenseCategory").value = item.categoria;
    el("walletExpenseSubmit").textContent = "Salvar edição pessoal";
    el("walletExpenseCancel").hidden = false;
    openExpense();
  }
  async function removeExpense(item: Expense) {
    const id = selected,
      version = sessionVersion;
    if (
      !(await ctx.ui.confirmAction({
        title: "Excluir gasto pessoal?",
        message: item.descricao,
        confirmLabel: "Excluir",
        variant: "danger",
      }))
    )
      return;
    if (version !== sessionVersion) return;
    try {
      await write(
        ctx.api.saveWalletExpense({
          action: "delete",
          id: item.id,
          walletId: id,
        }),
      );
      clearExpense();
      await loadExpenses();
    } catch (e) {
      message(errorMessage(e), true);
    }
  }
  return {
    init,
    load,
    beginExpense,
    reviewText,
    selectedWallet: () => selected,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    select(id: string) {
      selected = id;
      clearExpense();
      void loadExpenses();
    },
    changeMonth(period: string) {
      selectedMonth = period;
      clearExpense();
      void loadExpenses();
    },
    addExpense() {
      clearExpense();
      openExpense();
    },
    async saveGoal(goal: Goal | null) {
      const version = sessionVersion;
      await ctx.api.saveWalletGoal({ walletId: selected, goal });
      if (version === sessionVersion) await load();
    },
    async reveal(id: string, period: string, simulate = false) {
      await load();
      if (!wallets.some((w) => w.id === id))
        throw new Error("Carteira indisponível.");
      selected = id;
      selectedMonth = period;
      await loadExpenses();
      if (phase === "error") throw new Error(status);
      if (simulate) openSimulator();
    },
    openCreate,
    editLimit,
    openSimulator,
    editExpense,
    removeExpense,
    explain,
  };
}
export type WalletController = ReturnType<typeof createWalletController>;
