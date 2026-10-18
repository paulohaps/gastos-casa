import { useMemo, useState, useSyncExternalStore } from "react";
import { LoadingSkeleton, ErrorState } from "../../shared/ui/States";
import { FilterBar } from "./components/FilterBar";
import { BalanceSummary } from "./components/BalanceSummary";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { DashboardPanels } from "./components/DashboardPanels";
import { useDashboardSelection } from "./useDashboardSelection";
import type { OverviewController } from "./controller";
import { WorkspaceToolbar } from "./components/WorkspaceToolbar";
import {
  OverviewDetails,
  type OverviewDetail,
} from "./components/OverviewDetails";
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
  const revision = useMemo(
    () => ({}),
    [
      state.period,
      state.phase,
      state.expenses,
      state.payments,
      filters,
      filters.type === "house" ? null : state.personal,
      filters.type === "house" ? null : state.personalPhase,
    ],
  );
  const [detail, setDetail] = useState<{
    kind: OverviewDetail;
    revision: object;
  } | null>(null);
  const inspect = (kind: OverviewDetail) => setDetail({ kind, revision });
  const activeDetail = detail?.revision === revision ? detail.kind : null;
  const { total, needsPersonal, people, categories } = view;
  return (
    <>
      <header className="home-heading premium-heading">
        <div>
          <p className="eyebrow">MEU ESPAÇO FINANCEIRO</p>
          <h1 id="homeTitle">Minha situação</h1>
        </div>
        <span id="homePeriod" className="premium-period">
          {state.period || "Carregando período"}
        </span>
      </header>
      {state.phase === "loading" && (
        <LoadingSkeleton label="Carregando dashboard" />
      )}
      {state.phase === "error" && !state.requestFailed && (
        <ErrorState
          message="Não foi possível confirmar os dados completos deste período. Os indicadores estão indisponíveis."
          retry={() => window.mudarMes()}
        />
      )}
      <div
        className="premium-dashboard finance-workspace"
        data-month-content=""
        hidden={state.phase === "loading" || state.phase === "error"}
      >
        <div className="workspace-controls">
          <WorkspaceToolbar
            filters={filters}
            onChange={controller.filters.set}
          />
          <FilterBar
            filters={filters}
            categories={categories}
            people={people}
            onChange={controller.filters.set}
            reset={controller.filters.reset}
          />
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
        {filters.type !== "personal" && (
          <BalanceSummary
            balance={view.balance}
            compatible={view.balanceCompatible}
            period={state.period}
            onInspect={() => inspect("balance")}
          />
        )}
        {filters.type === "personal" && (
          <div className="personal-workspace-intro">
            <span>SÓ VOCÊ TEM ACESSO</span>
            <h2>Seu dinheiro, separado da Casa.</h2>
            <p>
              {state.walletName} · {state.period}
            </p>
          </div>
        )}
        <DashboardMetrics
          state={state}
          filters={filters}
          view={view}
          onInspect={inspect}
        />
        <DashboardPanels
          state={state}
          filters={filters}
          view={view}
          onOpenPersonal={controller.openPersonal}
          onQueryChange={(query) => controller.filters.set({ query })}
        />
      </div>
      {activeDetail && (
        <OverviewDetails
          kind={activeDetail}
          state={state}
          view={view}
          filters={filters}
          onClose={() => setDetail(null)}
          onOpenPersonal={controller.openPersonal}
        />
      )}
    </>
  );
}
