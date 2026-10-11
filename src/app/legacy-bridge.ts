import type {
  AssistantApi,
  AssistantPorts,
  Context,
} from "../features/assistant/contracts";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
declare global {
  interface Window {
    GastosSettings: {
      init(ports: import("../features/settings/contracts").SettingsPorts): void;
    };
    GastosMembers: {
      load(): void;
      toggleForm(open?: boolean): void;
    };
    carregarMembros(): void;
    toggleMembroForm(open?: boolean): void;
    GastosExperience: import("../features/overview/controller").OverviewController;
    GastosAssistant: {
      init(options: { api: AssistantApi; getSelectedMonth(): string }): void;
    };
    GastosNavigation: {
      show(view: string): void;
      showHouse(view: string): void;
      showAndReveal(
        view: string,
        selector: string,
        options?: { focusSelector?: string },
      ): void;
      current(): string;
    };
    GastosWallets: import("../features/wallets/controller").WalletController;
    GastosSmartEntry: {
      interpretExternal(text: string, source: string): Promise<void>;
    };
  }
}
// Temporary boundary: financial screens retain their tested engines while each
// feature is replaced. React owns the entire assistant subtree, never shared DOM.
export function mountAssistant(render: (ports: AssistantPorts) => ReactNode) {
  let mounted = false;
  window.GastosAssistant = {
    init({ api, getSelectedMonth }) {
      if (mounted) return;
      const node = document.getElementById("assistantIntro");
      if (!node) throw new Error("Tela do assistente ausente.");
      mounted = true;
      const ports: AssistantPorts = {
        api,
        getSelectedMonth,
        navigate: (view) => window.GastosNavigation.show(view),
        async openFinance(context, action) {
          if (context.scope === "wallet") {
            window.GastosNavigation.show("carteiras");
            await window.GastosWallets.reveal(
              context.walletId,
              context.month,
              action === "simulate",
            );
            if (action === "expenses") {
              const node = document.getElementById("walletMovements");
              node?.scrollIntoView({ block: "start" });
              node?.focus({ preventScroll: true });
            }
          } else {
            const select = document.getElementById(
              "seletorMes",
            ) as HTMLSelectElement;
            const period = context.month.split("-").reverse().join("/");
            if (![...select.options].some((option) => option.value === period))
              throw new Error(
                "Este mês não está disponível na Casa. Escolha um período disponível.",
              );
            if (select.value !== period) {
              select.value = period;
              select.dispatchEvent(new Event("change"));
            }
            window.GastosNavigation.showHouse("despesas");
          }
        },
        async review(text: string, context: Context) {
          if (context.scope === "wallet") {
            window.GastosNavigation.show("carteiras");
            await window.GastosWallets.reviewText(
              text,
              context.walletId,
              context.month,
            );
          } else {
            window.GastosNavigation.show("lancar");
            await window.GastosSmartEntry.interpretExternal(text, "text");
          }
        },
      };
      flushSync(() => createRoot(node).render(render(ports)));
    },
  };
}

export function mountWallets(
  controller: Window["GastosWallets"],
  render: (controller: Window["GastosWallets"]) => ReactNode,
) {
  let mounted = false;
  const initialize = controller.init;
  window.GastosWallets = controller;
  controller.init = (ports) => {
    if (mounted) return;
    const node = document.getElementById("personalWallets");
    if (!node) throw new Error("Tela do cofre ausente.");
    mounted = true;
    flushSync(() => createRoot(node).render(render(controller)));
    initialize(ports);
  };
}

export function mountOverview(
  controller: Window["GastosExperience"],
  render: (controller: Window["GastosExperience"]) => ReactNode,
) {
  let mounted = false;
  const initialize = controller.init;
  window.GastosExperience = controller;
  controller.init = (ports) => {
    if (mounted) return;
    const node = document.getElementById("homeView");
    if (!node) throw new Error("Tela inicial ausente.");
    mounted = true;
    flushSync(() => createRoot(node).render(render(controller)));
    initialize(ports);
  };
}

export function mountSettings(
  render: (
    ports: import("../features/settings/contracts").SettingsPorts,
  ) => ReactNode,
) {
  let mounted = false;
  const load = () =>
    window.dispatchEvent(new CustomEvent("gastos:membersload"));
  const toggleForm = (open?: boolean) =>
    window.dispatchEvent(
      new CustomEvent("gastos:memberstoggle", { detail: { open } }),
    );
  window.GastosSettings = {
    init(ports) {
      if (mounted) return;
      const node = document.getElementById("settingsControls");
      if (!node) throw new Error("Tela de ajustes ausente.");
      mounted = true;
      flushSync(() => createRoot(node).render(render(ports)));
      document.addEventListener("click", (event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest("[data-ai-open]")
        )
          return;
        window.GastosNavigation.showAndReveal("ajustes", "#aiSettingsPanel", {
          focusSelector: "#aiProvider",
        });
      });
    },
  };
  window.GastosMembers = { load, toggleForm };
  window.carregarMembros = load;
  window.toggleMembroForm = toggleForm;
}
