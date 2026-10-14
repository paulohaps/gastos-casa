import type { MonthRows } from "../types";
import {
  safeTotal,
  selectExpenses,
} from "../../../../js/core/financial-selection.mjs";
import type { FinancialFilters } from "../filters";
import { formatCurrency } from "../../../shared/finance/currency";
export function MonthlyTrend({
  house,
  personal,
  filters,
  selected,
  personalPhase,
}: {
  house: MonthRows[];
  personal: MonthRows[];
  filters: FinancialFilters;
  selected: string;
  personalPhase: string;
}) {
  const points = house.map((row) => {
    const privateMonth =
      row.month === selected
        ? {
            rows: personal.find((item) => item.month === row.month)?.rows || [],
            phase: personalPhase,
          }
        : personal.find((item) => item.month === row.month);
    const needHouse = filters.type !== "personal";
    const needPersonal =
      filters.type !== "house" && !filters.person && !filters.method;
    const unknown =
      (needHouse && row.phase === "error") ||
      (needPersonal &&
        (!privateMonth ||
          privateMonth.phase === "error" ||
          privateMonth.phase === "loading"));
    const rows = [
      ...(needHouse ? row.rows : []),
      ...(needPersonal ? privateMonth?.rows || [] : []),
    ];
    return {
      month: row.month,
      value: unknown ? null : safeTotal(selectExpenses(rows, filters)),
    };
  });
  const max = Math.max(1, ...points.map((point) => point.value || 0));
  return (
    <div className="monthly-trend" aria-label="Evolução mensal da seleção">
      {points.map((point) => (
        <button
          type="button"
          key={point.month}
          className={point.month === selected ? "is-selected" : ""}
          onClick={() => {
            const month = document.getElementById(
              "seletorMes",
            ) as HTMLSelectElement;
            const value = point.month.split("-").reverse().join("/");
            if (![...month.options].some((option) => option.value === value))
              month.add(new Option(value, value));
            month.value = value;
            month.dispatchEvent(new Event("change"));
          }}
          aria-label={
            point.month +
            ": " +
            (point.value === null
              ? "Indisponível"
              : formatCurrency(point.value / 100))
          }
        >
          <strong>
            {point.value === null ? "—" : formatCurrency(point.value / 100)}
          </strong>
          <span className="monthly-trend__plot" aria-hidden="true">
            <span
              style={{
                height:
                  point.value === null
                    ? "0"
                    : Math.max(2, (point.value / max) * 100) + "%",
              }}
            />
          </span>
          <small>
            {new Intl.DateTimeFormat("pt-BR", {
              month: "short",
              year: "2-digit",
              timeZone: "UTC",
            }).format(new Date(point.month + "-01T12:00:00Z"))}
          </small>
          {point.value === null && <small>Indisponível</small>}
        </button>
      ))}
    </div>
  );
}
