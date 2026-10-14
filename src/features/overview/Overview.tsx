import { useSyncExternalStore } from "react";
import { LoadingSkeleton, ErrorState } from "../../shared/ui/States";
import { FilterBar } from "./components/FilterBar";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { DashboardPanels } from "./components/DashboardPanels";
import { useDashboardSelection } from "./useDashboardSelection";
import type { OverviewController } from "./controller";
export function Overview({ controller }: { controller: OverviewController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const filters = useSyncExternalStore(
    controller.filters.subscribe,
    controller.filters.getSnapshot,
  );
  const view = useDashboardSelection(state, filters);
  const { rows, total, needsPersonal, people, categories } = view;
  return (
    <>
      <header className="home-heading premium-heading">
        <div>
          <p className="eyebrow">VISÃO FINANCEIRA</p>
          <h1 id="homeTitle">Seu resumo financeiro</h1>
          <p className="view-panel-description">
            Gastos registrados, planejamento e acertos do período.
          </p>
        </div>
        <span id="homePeriod" className="premium-period">
          {state.period || "Carregando período"}
        </span>
      </header>
      {state.phase === "loading" && (
        <LoadingSkeleton label="Carregando dashboard" />
      )}
      {state.phase === "error" && (
        <ErrorState
          message="Não foi possível confirmar os dados completos deste período. Os indicadores estão indisponíveis."
          retry={() => window.mudarMes()}
        />
      )}
      <div
        className="premium-dashboard"
        data-month-content=""
        hidden={state.phase === "loading" || state.phase === "error"}
      >
        <FilterBar
          filters={filters}
          categories={categories}
          people={people}
          onChange={controller.filters.set}
          reset={controller.filters.reset}
        />
        <div className="dashboard-search">
          <label htmlFor="dashboardQuery">Buscar despesas do período</label>
          <input
            id="dashboardQuery"
            type="search"
            placeholder="Descrição ou categoria"
            value={filters.query}
            onChange={(event) =>
              controller.filters.set({ query: event.target.value })
            }
          />
          <span>
            {rows.length} {rows.length === 1 ? "movimentação" : "movimentações"}{" "}
            na seleção
          </span>
        </div>
        {needsPersonal && state.personalPhase === "loading" && (
          <LoadingSkeleton label="Carregando seu cofre" />
        )}
        {needsPersonal && state.personalPhase === "error" && (
          <ErrorState
            message="Seu cofre não carregou. Os totais que dependem dele estão indisponíveis."
            retry={() => void controller.retryPersonal()}
          />
        )}
        {total === null && (
          <ErrorState message="Há um valor monetário inválido nesta seleção. Os totais não podem ser confirmados." />
        )}
        <DashboardMetrics state={state} filters={filters} view={view} />
        <section
          className="home-shortcuts premium-shortcuts"
          aria-label="Atalhos financeiros"
        >
          <button
            type="button"
            className="btn btn--secondary"
            data-entry-open=""
          >
            Registrar gasto
          </button>
          <a
            className="btn btn--secondary"
            data-app-nav="casa"
            data-house-link="planejamento"
            href="#casa"
          >
            Planejar o mês
          </a>
          <a
            className="btn btn--secondary"
            data-app-nav="casa"
            data-house-link="acertos"
            href="#casa"
          >
            Conferir acertos
          </a>
        </section>
        <DashboardPanels
          state={state}
          filters={filters}
          view={view}
          onOpenPersonal={controller.openPersonal}
        />
      </div>
    </>
  );
}
