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
  const maximum = Math.max(100, ...points.map((point) => point.value ?? 0));
  const unit = 10 ** Math.floor(Math.log10(maximum));
  const ceiling = Math.ceil(maximum / unit) * unit;
  const width = 720,
    height = 218,
    left = 74,
    right = 24,
    top = 18,
    bottom = 22;
  const plotHeight = height - top - bottom;
  const x = (index: number) =>
    left + (index * (width - left - right)) / Math.max(1, points.length - 1);
  const y = (value: number) => top + plotHeight * (1 - value / ceiling);
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(month + "-01T12:00:00Z"));
  const choose = (month: string) => {
    const picker = document.getElementById("seletorMes") as HTMLSelectElement;
    const value = month.split("-").reverse().join("/");
    if (![...picker.options].some((option) => option.value === value))
      picker.add(new Option(value, value));
    picker.value = value;
    picker.dispatchEvent(new Event("change", { bubbles: true }));
  };
  return (
    <div className="monthly-trend" aria-label="Evolução mensal da seleção">
      <svg
        className="monthly-trend__chart"
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={left}
              x2={width - right}
              y1={y(ceiling * ratio)}
              y2={y(ceiling * ratio)}
              className="trend-grid"
            />
            <text
              x={left - 12}
              y={y(ceiling * ratio) + 4}
              textAnchor="end"
              className="trend-axis"
            >
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: ceiling < 10000 ? 2 : 0,
              }).format((ceiling * ratio) / 100)}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const previous = points[index - 1];
          if (point.value === null) return null;
          return (
            <g key={point.month}>
              {previous && previous.value !== null && (
                <line
                  x1={x(index - 1)}
                  x2={x(index)}
                  y1={y(previous.value)}
                  y2={y(point.value)}
                  className="trend-line"
                />
              )}
              <line
                x1={x(index)}
                x2={x(index)}
                y1={y(point.value)}
                y2={y(0)}
                className="trend-guide"
              />
              <circle
                cx={x(index)}
                cy={y(point.value)}
                r={point.month === selected ? 5 : 3.5}
                className={
                  point.month === selected
                    ? "trend-point is-selected"
                    : "trend-point"
                }
              />
            </g>
          );
        })}
      </svg>
      <div className="monthly-trend__labels">
        {points.map((point) => (
          <button
            type="button"
            key={point.month}
            className={point.month === selected ? "is-selected" : ""}
            onClick={() => choose(point.month)}
            aria-pressed={point.month === selected}
            aria-label={
              point.month +
              ": " +
              (point.value === null
                ? "Indisponível"
                : formatCurrency(point.value / 100))
            }
          >
            <small>{monthLabel(point.month)}</small>
            <strong>
              {point.value === null ? "—" : formatCurrency(point.value / 100)}
            </strong>
            {point.value === null && <span>Indisponível</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
