import { useEffect } from "react";
import type { FinancialRow } from "../../../../js/core/financial-selection.mjs";
export function ExpenseDistribution({
  rows,
  period,
}: {
  rows: FinancialRow[];
  period: string;
}) {
  useEffect(() => {
    window.GastosCharts.render("homeCategoryChart", {
      expenses: rows,
      context: period,
    });
  }, [rows, period]);
  return (
    <div
      id="homeCategoryChart"
      className="explore-chart"
      aria-label="Distribuição dos gastos da seleção"
    />
  );
}
