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
    GastosAssistant: {
      init(options: { api: AssistantApi; getSelectedMonth(): string }): void;
    };
    GastosNavigation: { show(view: string): void; current(): string };
    GastosWallets: {
      reviewText(text: string, walletId: string, month: string): Promise<void>;
    };
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
