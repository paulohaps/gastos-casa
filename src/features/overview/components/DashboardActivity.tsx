import { useEffect, useState } from "react";
import type { FinancialRow } from "../../../../js/core/financial-selection.mjs";
import type { FinancialFilters } from "../filters";
import type { WorkspaceSection } from "./WorkspaceSections";
import { ChartCard } from "../../../shared/ui/ChartCard";
import { TransactionList } from "./TransactionList";
export function DashboardActivity({
  rows,
  period,
  filters,
  onOpenPersonal,
  onQueryChange,
  section,
  onInspectExpense,
}: {
  rows: FinancialRow[];
  period: string;
  filters: FinancialFilters;
  onOpenPersonal(): void;
  onQueryChange(query: string): void;
  section: WorkspaceSection;
  onInspectExpense(row: FinancialRow): void;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filters, section, period]);
  const pageSize = section === "activity" ? 25 : 5;
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  return (
    <div
      hidden={section === "analysis"}
      className="workspace-ledger"
      id="workspaceLedger"
    >
      <ChartCard
        title={
          section === "activity" ? "Movimentações" : "Últimas movimentações"
        }
        id="homeMovementsTitle"
        className="dashboard-wide home-activity"
      >
        <div className="transaction-toolbar">
          <div className="dashboard-search">
            <label className="sr-only" htmlFor="dashboardQuery">
              Buscar despesas do período
            </label>
            <input
              id="dashboardQuery"
              type="search"
              placeholder="Buscar no período"
              value={filters.query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <span>
            {rows.length} {rows.length === 1 ? "movimentação" : "movimentações"}{" "}
            na seleção
          </span>
        </div>
        <TransactionList
          rows={rows}
          offset={currentPage * pageSize}
          limit={pageSize}
          onInspect={onInspectExpense}
        />
        {section === "activity" && rows.length > pageSize && (
          <div
            className="transaction-pagination"
            role="group"
            aria-label="Páginas de movimentações"
          >
            <span aria-live="polite">
              {currentPage * pageSize + 1}–
              {Math.min(rows.length, (currentPage + 1) * pageSize)} de{" "}
              {rows.length}
            </span>
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={currentPage === lastPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Próxima
            </button>
          </div>
        )}
        {filters.type === "personal" ? (
          <button
            type="button"
            className="dashboard-link text-link"
            onClick={onOpenPersonal}
          >
            Consultar histórico →
          </button>
        ) : (
          <a
            className="dashboard-link text-link"
            data-app-nav="casa"
            data-house-link="despesas"
            href="#casa"
          >
            Consultar histórico →
          </a>
        )}
      </ChartCard>
    </div>
  );
}
