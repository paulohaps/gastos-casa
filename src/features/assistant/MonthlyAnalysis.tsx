import { periodLabel } from "../../../js/core/analysis-period.mjs";
import { formatCurrency as money } from "../../shared/finance/currency";
import type { Analysis } from "./contracts";

export function MonthlyAnalysis({
  analysis,
  disabled,
  onOpen,
}: {
  analysis: Analysis;
  disabled: boolean;
  onOpen(month: string): void;
}) {
  const maximum = Math.max(...analysis.months.map((month) => month.total));
  return (
    <section
      className="chat-analysis"
      aria-label="Gastos calculados no período"
    >
      <div className="chat-analysis-heading">
        <span>
          {periodLabel({
            month: analysis.endMonth,
            startMonth: analysis.startMonth,
          })}
        </span>
        <strong>{money(analysis.total)}</strong>
      </div>
      <p>
        {analysis.count}{" "}
        {analysis.count === 1
          ? "lançamento registrado"
          : "lançamentos registrados"}
      </p>
      <div className="chat-month-bars">
        {analysis.months.map((row) => (
          <button
            key={row.month}
            type="button"
            disabled={disabled}
            onClick={() => onOpen(row.month)}
            aria-label={
              "Ver gastos de " +
              periodLabel({ month: row.month }) +
              ": " +
              money(row.total)
            }
          >
            <span>
              {analysis.months.length === 1
                ? "Ver lançamentos →"
                : periodLabel({ month: row.month })}
            </span>
            {analysis.months.length > 1 && <strong>{money(row.total)}</strong>}
            {analysis.months.length > 1 && (
              <span className="chat-month-track" aria-hidden="true">
                <span
                  style={{
                    width: (maximum ? (row.total / maximum) * 100 : 0) + "%",
                  }}
                />
              </span>
            )}
            {row.count === 0 && <small>Sem lançamentos</small>}
          </button>
        ))}
      </div>
      <small>
        Resumo registrado nesta resposta; não representa saldo bancário.
      </small>
    </section>
  );
}
