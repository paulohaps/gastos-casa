import { useEffect, useState, useSyncExternalStore } from "react";
import type { SettingsPorts } from "./contracts";
import { AiConnection } from "./AiConnection";
import { Members } from "./Members";
import { Rules } from "./Rules";
import { Metrics } from "./Metrics";
import { useTheme } from "../../app/usePreferences";
import "../../../css/settings.css";
import { useMediaQuery } from "../../shared/ui/useMediaQuery";
const destinations = [
  ["settingsAccount", "Minha conta"],
  ["settingsPreferences", "Preferências"],
  ["settingsMembers", "Participantes"],
  ["settingsCatalog", "Categorias e métodos"],
  ["settingsPrivacy", "Privacidade"],
  ["aiSettingsPanel", "Assistente e integrações"],
  ["settingsAdvanced", "Automação e qualidade"],
] as const;
const subscribeAccount = (listener: () => void) => {
  window.addEventListener("gastos:userchange", listener);
  window.addEventListener("gastos:sessioncleared", listener);
  return () => {
    window.removeEventListener("gastos:userchange", listener);
    window.removeEventListener("gastos:sessioncleared", listener);
  };
};
export function Settings({ ports }: { ports: SettingsPorts }) {
  const [active, setActive] = useState<string>("settingsAccount");
  useEffect(() => {
    const sync = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail.id;
      if (destinations.some(([target]) => target === id)) setActive(id);
    };
    window.addEventListener("gastos:settingsreveal", sync);
    return () => window.removeEventListener("gastos:settingsreveal", sync);
  }, []);
  const account = useSyncExternalStore(subscribeAccount, ports.getAccountName);
  const { theme } = useTheme();
  const mobile = useMediaQuery("(max-width: 767px)");
  const reveal = (id: string) => {
    setActive(id);
    const target = document.getElementById(id);
    for (
      let ancestor = target?.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    }
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    target?.focus({ preventScroll: true });
  };
  return (
    <>
      <header className="settings-heading">
        <h1>Ajustes</h1>
      </header>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Seções dos ajustes">
          {mobile ? (
            <label className="settings-jump">
              <span>Ir para</span>
              <select
                aria-label="Seção dos ajustes"
                value={active}
                onChange={(e) => reveal(e.target.value)}
              >
                {destinations.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            destinations.map(([id, label]) => (
              <a
                key={id}
                href="#ajustes"
                aria-current={active === id ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  reveal(id);
                }}
              >
                {label}
              </a>
            ))
          )}
        </nav>
        <div className="settings-sections">
          <section
            className="settings-section"
            id="settingsAccount"
            tabIndex={-1}
            aria-labelledby="settingsAccountTitle"
          >
            <h2 id="settingsAccountTitle">Minha conta</h2>
            <div className="settings-row">
              <span>Conta conectada</span>
              <strong>{account || "Aguardando sessão"}</strong>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => document.getElementById("btnLogout")?.click()}
              >
                Sair da conta
              </button>
            </div>
          </section>
          <section
            className="settings-section"
            id="settingsPreferences"
            tabIndex={-1}
            aria-labelledby="settingsPreferencesTitle"
          >
            <h2 id="settingsPreferencesTitle">Preferências</h2>
            <div className="settings-row">
              <span>Aparência</span>
              <div className="theme-options" role="group" aria-label="Tema">
                <button
                  type="button"
                  aria-pressed={theme === "dark"}
                  onClick={() => window.GastosTheme.set("dark")}
                >
                  Escuro
                </button>
                <button
                  type="button"
                  aria-pressed={theme === "light"}
                  onClick={() => window.GastosTheme.set("light")}
                >
                  Claro
                </button>
              </div>
            </div>
          </section>
          <section id="settingsMembers" tabIndex={-1}>
            <Members ports={ports} />
          </section>
          <section
            className="settings-section"
            id="settingsCatalog"
            tabIndex={-1}
            aria-labelledby="settingsCatalogTitle"
          >
            <h2 id="settingsCatalogTitle">Categorias e métodos</h2>
            <dl className="settings-catalog">
              <div>
                <dt>Categorias da Casa</dt>
                <dd>{ports.categories.join(" · ")}</dd>
              </div>
              <div>
                <dt>Pagamento na Casa</dt>
                <dd>{ports.getPaymentMethods().join(" · ")}</dd>
              </div>
            </dl>
          </section>
          <section
            className="settings-section"
            id="settingsPrivacy"
            tabIndex={-1}
            aria-labelledby="settingsPrivacyTitle"
          >
            <h2 id="settingsPrivacyTitle">Privacidade</h2>
            <dl className="settings-catalog">
              <div>
                <dt>Compartilhado</dt>
                <dd>
                  Despesas e acertos da Casa, com os participantes autorizados.
                </dd>
              </div>
              <div>
                <dt>Só você</dt>
                <dd>Cofre pessoal, chaves de IA e conversas.</dd>
              </div>
            </dl>
            <a
              className="text-link"
              href="#assistente"
              data-app-nav="assistente"
            >
              Consultar meu histórico de conversa →
            </a>
          </section>
          <details className="settings-disclosure" id="settingsIntegrations">
            <summary>Assistente e integrações</summary>
            <AiConnection ports={ports} />
          </details>
          <details
            className="settings-disclosure"
            id="settingsAdvanced"
            tabIndex={-1}
            aria-label="Automação e qualidade"
          >
            <summary>Automação e qualidade</summary>
            <Rules ports={ports} />
            <Metrics ports={ports} />
          </details>
        </div>
      </div>
    </>
  );
}
