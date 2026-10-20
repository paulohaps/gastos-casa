import { localDate, isoDate } from "../../../../js/core/calendar.mjs";
import { useMemo } from "react";
import { expenseIntelligence } from "../../../../js/core/expense-intelligence.mjs";
import { selectExpenses } from "../../../../js/core/financial-selection.mjs";
import { shiftMonth } from "../../../../js/core/analysis-period.mjs";
import type { OverviewState } from "../types";
import type { FinancialFilters } from "../filters";
import type { DashboardSelection } from "../useDashboardSelection";
export function SpendingReading({
  state,
  filters,
  view,
}: {
  state: OverviewState;
  filters: FinancialFilters;
  view: DashboardSelection;
}) {
  const reading = useMemo(() => {
    if (view.incomplete || view.total === null || !view.rows.length)
      return null;
    try {
      const month = state.period.split("/").reverse().join("-");
      const previousMonth = shiftMonth(month, -1);
      const house = state.history.find((item) => item.month === previousMonth);
      const personal = state.personalHistory.find(
        (item) => item.month === previousMonth,
      );
      const needsHouse = filters.type !== "personal",
        needsPersonal = filters.type !== "house";
      const complete =
        (!needsHouse ||
          Boolean(
            house && house.phase !== "error" && house.phase !== "loading",
          )) &&
        (!needsPersonal ||
          Boolean(
            personal &&
              personal.phase !== "error" &&
              personal.phase !== "loading",
          ));
      return expenseIntelligence({
        current: view.rows.map((row) => ({ ...row, data: isoDate(row.data) })),
        previous: complete
          ? selectExpenses(
              [
                ...(needsHouse ? house?.rows || [] : []),
                ...(needsPersonal ? personal?.rows || [] : []),
              ],
              filters,
            ).map((row) => ({ ...row, data: isoDate(row.data) }))
          : [],
        context: { scope: filters.type, month },
        today: localDate(),
        baselineComplete: complete,
      });
    } catch {
      return null;
    }
  }, [
    state.period,
    state.history,
    state.personalHistory,
    filters,
    view.incomplete,
    view.total,
    view.rows,
  ]);
  if (!reading?.concentration) return null;
  const concentration = reading.concentration;
  return (
    <section className="spending-reading" aria-label="Leitura dos gastos">
      <div>
        <span>LEITURA DO MÊS</span>
        <p>
          <strong>{concentration.category}</strong> concentra{" "}
          {concentration.percent.toLocaleString("pt-BR")}% dos gastos
          registrados até hoje nesta seleção.
        </p>
        <small>
          {reading.evidence === "insufficient"
            ? "Amostra pequena: é um retrato dos registros, ainda não um padrão."
            : `${reading.recordCount} lançamentos em ${reading.observedDays} dias com gastos registrados.`}
        </small>
      </div>
      <button
        className="text-link"
        type="button"
        onClick={() => window.GastosNavigation.show("assistente")}
      >
        Conversar com o assistente →
      </button>
    </section>
  );
}
