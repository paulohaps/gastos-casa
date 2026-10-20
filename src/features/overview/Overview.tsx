import { SpendingReading } from "./components/SpendingReading";
import { useAppView } from "../../app/useAppView";
import { useMediaQuery } from "../../shared/ui/useMediaQuery";
import { QuickExpenseButton } from "../../shared/ui/QuickExpenseButton";
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
  WorkspaceSections,
  type WorkspaceSection,
} from "./components/WorkspaceSections";
import { ActionRail } from "./components/ActionRail";
import { ExpenseInspector } from "./components/ExpenseInspector";
import type { FinancialRow } from "../../../js/core/financial-selection.mjs";
import {
  OverviewDetails,
  type OverviewDetail,
} from "./components/OverviewDetails";
export function Overview({ controller }: { controller: OverviewController }) {
  const activeView = useAppView();
  const mobile = useMediaQuery("(max-width: 900px)");
  const phone = useMediaQuery("(max-width: 767px)");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const filters = useSyncExternalStore(
    controller.filters.subscribe,
    controller.filters.getSnapshot,
  );
  const view = useDashboardSelection(state, filters);
  const [section, setSection] = useState<WorkspaceSection>("today");
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
  const [expense, setExpense] = useState<{
    row: FinancialRow;
    revision: object;
  } | null>(null);
  const inspect = (kind: OverviewDetail) => setDetail({ kind, revision });
  const activeDetail = detail?.revision === revision ? detail.kind : null;
  const openSection = (next: WorkspaceSection) => {
    setSection(next);
    requestAnimationFrame(() =>
      document
        .getElementById(
          next === "activity" ? "dashboardQuery" : "workspaceTab-" + next,
        )
        ?.focus(),
    );
  };
  const { total, needsPersonal, people, categories } = view;
  return (
    <>
      <header className="home-heading premium-heading">
        <div>
          <p className="eyebrow">
            {state.owner
              ? "Olá, " + state.owner.split(" ")[0]
              : "Seu espaço financeiro"}
          </p>
          <h1 id="homeTitle">
            {section === "today"
              ? "Seus gastos"
              : section === "activity"
                ? "Suas movimentações"
                : "Entenda seus números"}
          </h1>
        </div>
        <div className="home-heading-actions">
          <span id="homePeriod" className="premium-period">
            {state.period || "Carregando período"}
          </span>
          {mobile &&
            activeView === "resumo" &&
            ["success", "empty"].includes(state.phase) && (
              <QuickExpenseButton className="overview-entry-button quick-expense-fab" />
            )}
        </div>
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
        className="premium-dashboard finance-workspace operational-workspace"
        data-month-content=""
        hidden={state.phase === "loading" || state.phase === "error"}
      >
        <WorkspaceSections value={section} onChange={setSection} />
        <div className="workspace-controls">
          {!phone && (
            <WorkspaceToolbar
              filters={filters}
              hideShortcuts
              onChange={controller.filters.set}
            />
          )}
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
        <section
          className={"workspace-room workspace-room--" + section}
          id="workspacePanel"
          role="tabpanel"
          aria-labelledby={"workspaceTab-" + section}
          tabIndex={0}
        >
          <DashboardMetrics
            state={state}
            filters={filters}
            view={view}
            onInspect={inspect}
          />
          <div className="workspace-now" hidden={section !== "today"}>
            <ActionRail
              personal={filters.type === "personal"}
              canInspectBalance={Boolean(view.balance)}
              onBalance={() => inspect("balance")}
              onHistory={() => openSection("activity")}
              onAnalysis={() => openSection("analysis")}
            />
            <div className="workspace-situation">
              {filters.type !== "personal" && (
                <BalanceSummary
                  status={view.balanceStatus}
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
            </div>
          </div>
          {section === "today" && (
            <SpendingReading state={state} filters={filters} view={view} />
          )}
          <DashboardPanels
            state={state}
            filters={filters}
            view={view}
            onOpenPersonal={controller.openPersonal}
            onQueryChange={(query) => controller.filters.set({ query })}
            section={section}
            onInspectExpense={(row) => {
              setDetail(null);
              setExpense({ row, revision });
            }}
          />
        </section>
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
      {expense?.revision === revision && (
        <ExpenseInspector
          row={expense.row}
          period={state.period}
          onClose={() => setExpense(null)}
          onManage={() => {
            const row = expense.row;
            setExpense(null);
            if (row.scope === "personal") controller.openPersonal();
            else {
              controller.filters.set({ type: "house", query: row.descricao });
              window.GastosNavigation.showHouse("despesas");
            }
          }}
        />
      )}
    </>
  );
}
