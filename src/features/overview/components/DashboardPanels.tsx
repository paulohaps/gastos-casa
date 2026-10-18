import type { FinancialRow } from "../../../../js/core/financial-selection.mjs";
import type { WorkspaceSection } from "./WorkspaceSections";
import type { OverviewState } from "../types";
import type { FinancialFilters } from "../filters";
import type { DashboardSelection } from "../useDashboardSelection";
import { DashboardActivity } from "./DashboardActivity";
import { DashboardAnalytics } from "./DashboardAnalytics";
export function DashboardPanels({
  state,
  filters,
  view,
  onOpenPersonal,
  onQueryChange,
  section,
  onInspectExpense,
}: {
  state: OverviewState;
  filters: FinancialFilters;
  view: DashboardSelection;
  onOpenPersonal(): void;
  onQueryChange(query: string): void;
  section: WorkspaceSection;
  onInspectExpense(row: FinancialRow): void;
}) {
  return (
    <div className="dashboard-grid">
      <DashboardActivity
        rows={view.rows}
        period={state.period}
        filters={filters}
        onOpenPersonal={onOpenPersonal}
        onQueryChange={onQueryChange}
        section={section}
        onInspectExpense={onInspectExpense}
      />
      <DashboardAnalytics
        state={state}
        filters={filters}
        view={view}
        onOpenPersonal={onOpenPersonal}
        section={section}
      />
    </div>
  );
}
