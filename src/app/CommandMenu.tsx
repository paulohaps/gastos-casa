import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { containDialogFocus } from "../shared/ui/dialog";
import { Icon } from "../shared/ui/Icon";

const actions = [
  {
    label: "Visão geral",
    hint: "Seu painel financeiro",
    icon: "home",
    view: "resumo",
  },
  {
    label: "Despesas da casa",
    hint: "Buscar e editar lançamentos",
    icon: "house",
    house: "despesas",
  },
  {
    label: "Acerto de contas",
    hint: "Consultar pagamentos registrados",
    icon: "check",
    house: "acertos",
  },
  {
    label: "Planejamento da casa",
    hint: "Metas por categoria e recorrentes",
    icon: "clock",
    house: "planejamento",
  },
  {
    label: "Cofre pessoal",
    hint: "Limite, reserva e metas pessoais",
    icon: "wallet",
    view: "carteiras",
  },
  {
    label: "Conversar com o Assistente",
    hint: "Analisar gastos e comparar meses",
    icon: "spark",
    view: "assistente",
  },
  {
    label: "Conectar minha IA",
    hint: "Gemini, DeepSeek e preferências",
    icon: "settings",
    view: "ajustes",
  },
];
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Native dialog owns focus and Escape; commands only navigate, never mutate finances. */
export function CommandMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const results = actions.filter((action) =>
    normalize(action.label + " " + action.hint).includes(
      normalize(query.trim()),
    ),
  );
  const open = () => {
    if (document.querySelector("dialog[open]")) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setQuery("");
    dialog.current?.showModal();
    search.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    };
    const close = () => dialog.current?.close();
    window.addEventListener("keydown", keydown);
    window.addEventListener("gastos:sessioncleared", close);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("gastos:sessioncleared", close);
    };
  }, []);
  const navigate = (action: (typeof actions)[number]) => {
    returnFocus.current = null;
    dialog.current?.close();
    if (action.house) window.GastosNavigation.showHouse(action.house);
    else if (action.view === "ajustes")
      window.GastosNavigation.showAndReveal("ajustes", "#aiSettingsPanel", {
        focusSelector: "#aiProvider",
      });
    else window.GastosNavigation.show(action.view!);
    requestAnimationFrame(() => {
      const heading = [
        ...document.querySelectorAll<HTMLElement>(".page h1"),
      ].find((node) => node.getClientRects().length);
      if (heading && heading.getClientRects().length) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  };
  return (
    <>
      <button
        className="command-trigger"
        type="button"
        onClick={open}
        aria-label="Buscar ações"
        aria-haspopup="dialog"
      >
        <Icon name="search" />
        <span>Buscar ações</span>
        <kbd>⌘ / Ctrl K</kbd>
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          id="commandDialog"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              dialog.current?.close();
            } else containDialogFocus(event);
          }}
          className="command-dialog"
          aria-labelledby="commandTitle"
          onClose={() => returnFocus.current?.focus({ preventScroll: true })}
        >
          <header>
            <div>
              <p className="eyebrow">ACESSO RÁPIDO</p>
              <h2 id="commandTitle">O que você quer fazer?</h2>
            </div>
            <button
              className="icon-btn"
              type="button"
              aria-label="Fechar busca"
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (results[0]) navigate(results[0]);
            }}
          >
            <label className="command-search">
              <Icon name="search" />
              <input
                ref={search}
                type="search"
                aria-label="Buscar ação ou área"
                placeholder="Ex.: despesas, metas, Gemini…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </form>
          <div className="command-results" aria-label="Ações encontradas">
            {results.map((action) => (
              <button
                type="button"
                key={action.label}
                onClick={() => navigate(action)}
              >
                <Icon name={action.icon} />
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.hint}</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
            {!results.length && (
              <div>
                <p role="status">
                  Nenhuma ação encontrada. Tente “casa”, “cofre” ou “IA”.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.GastosExperience.filters.set({ query, type: "all" });
                    navigate(actions[0]!);
                    requestAnimationFrame(() =>
                      document.getElementById("dashboardQuery")?.focus(),
                    );
                  }}
                >
                  Pesquisar “{query}” nas despesas do período
                </button>
              </div>
            )}
          </div>
          <footer>
            Digite para filtrar · Enter para abrir · Esc para fechar
          </footer>
        </dialog>,
        document.body,
      )}
    </>
  );
}
