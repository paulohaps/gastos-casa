import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CommandMenu } from "./CommandMenu";
import { Icon } from "../shared/ui/Icon";
const destinations = [
  { id: "resumo", label: "Início", icon: "home" },
  { id: "casa", label: "Casa", icon: "house" },
  { id: "carteiras", label: "Cofre", icon: "wallet" },
  { id: "assistente", label: "Assistente", icon: "spark" },
  { id: "ajustes", label: "Ajustes", icon: "settings" },
];
declare global {
  interface Window {
    mudarMes(): void;
    gerarResumo(): void;
  }
}
export function AppShell() {
  const [view, setView] = useState(document.body.dataset.appView || "resumo");
  useEffect(() => {
    const changed = (event: Event) =>
      setView((event as CustomEvent<{ view: string }>).detail.view);
    window.addEventListener("gastos:viewchange", changed);
    return () => window.removeEventListener("gastos:viewchange", changed);
  }, []);
  const links = (mobile = false) =>
    destinations.map((item) => {
      const active =
        view === item.id || (view === "lancar" && item.id === "casa");
      return (
        <a
          key={item.id}
          className={(mobile ? "" : "nav-link ") + (active ? "is-active" : "")}
          href={"#" + item.id}
          data-app-nav={item.id}
          aria-current={active ? "page" : undefined}
        >
          <Icon name={item.icon} />
          <span>
            {!mobile && item.id === "carteiras" ? "Cofre pessoal" : item.label}
          </span>
        </a>
      );
    });
  const sidebar = document.getElementById("shellSidebar"),
    header = document.getElementById("shellHeader"),
    mobile = document.getElementById("shellMobileNav");
  if (!sidebar || !header || !mobile) throw new Error("Navegação incompleta.");
  return (
    <>
      {createPortal(
        <>
          <a className="brand" data-app-nav="resumo" href="#resumo">
            <span className="brand__mark">
              <Icon name="layers" />
            </span>
            <span>
              <strong className="brand__title">
                gastos<span className="brand-period">.</span>
              </strong>
              <span className="brand__subtitle">ESPAÇO FINANCEIRO</span>
            </span>
          </a>
          <p className="sidebar-label">ORGANIZE SEU DIA</p>
          <nav aria-label="Navegação principal" className="desktop-nav">
            {links()}
          </nav>
          <button className="sidebar-create" data-entry-open="" type="button">
            <Icon name="plus" /> Novo gasto
          </button>
          <div className="sidebar-bottom">
            <a
              className="sidebar-note"
              href="#assistente"
              data-app-nav="assistente"
            >
              <Icon name="spark" />
              <span>
                <strong>Uma segunda perspectiva</strong>
                <br />
                Explore seus números com IA.
              </span>
            </a>
            <a
              className="sidebar-profile"
              data-app-nav="ajustes"
              href="#ajustes"
            >
              <span className="profile-avatar">G</span>
              <span>
                <strong>Meu espaço</strong>
                <small>Preferências e acesso</small>
              </span>
              <Icon name="arrow" />
            </a>
          </div>
        </>,
        sidebar,
      )}
      {createPortal(
        <div className="app-header__inner">
          <a
            className="skip-content"
            href="#visao-geral"
            onClick={(event) => {
              event.preventDefault();
              document.getElementById("visao-geral")?.focus();
            }}
          >
            Ir para o conteúdo
          </a>
          <a className="mobile-brand" data-app-nav="resumo" href="#resumo">
            gastos<span>.</span>
          </a>
          <div className="topbar-location">
            <span>Meu espaço</span>
            <span className="breadcrumb-slash">/</span>
            <strong id="topbarTitle">
              {view === "lancar"
                ? "Novo gasto"
                : destinations.find((item) => item.id === view)?.label ||
                  "Início"}
            </strong>
          </div>
          <CommandMenu />
          <div
            aria-label="Controles globais"
            className="header-actions"
            role="group"
          >
            <label
              aria-label="Mês da casa"
              className={
                "month-picker" +
                (["carteiras", "assistente", "ajustes"].includes(view)
                  ? " hidden"
                  : "")
              }
              title="Período dos gastos compartilhados"
            >
              <Icon name="clock" />
              <select id="seletorMes" onChange={() => window.mudarMes()}>
                <option value="">Carregando...</option>
              </select>
            </label>
            <button
              aria-label="Compartilhar resumo"
              className={
                "btn btn--secondary btn--compact" +
                (!["resumo", "casa"].includes(view) ? " hidden" : "")
              }
              onClick={() => window.gerarResumo()}
              type="button"
            >
              <Icon name="arrow" />
              <span className="btn-label">Compartilhar</span>
            </button>
            <span
              aria-live="polite"
              className="status-pill hidden"
              id="connectionStatus"
              role="status"
            />
          </div>
          <button
            className="btn btn--primary topbar-create"
            data-entry-open=""
            type="button"
          >
            <Icon name="plus" />
            <span>Novo gasto</span>
          </button>
        </div>,
        header,
      )}
      {createPortal(links(true), mobile)}
    </>
  );
}
