import { useEffect, useState } from "react";
import {
  analysisPeriod,
  periodLabel,
  shiftMonth,
} from "../../../js/core/analysis-period.mjs";
import type { Context } from "./contracts";

export function PeriodSelector({
  context,
  onChange,
}: {
  context: Context;
  onChange(context: Context): void;
}) {
  const [start, setStart] = useState(context.startMonth || context.month);
  const [end, setEnd] = useState(context.month);
  const [error, setError] = useState("");
  const period = analysisPeriod(context);
  useEffect(() => {
    setStart(context.startMonth || context.month);
    setEnd(context.month);
    setError("");
  }, [context]);
  function apply(first: string, last: string) {
    try {
      analysisPeriod({ month: last, startMonth: first });
      const { startMonth: _, ...scope } = context;
      onChange({
        ...scope,
        month: last,
        ...(first !== last ? { startMonth: first } : {}),
      });
      setError("");
    } catch {
      setError("Escolha meses válidos, em ordem, com no máximo 12 meses.");
    }
  }
  return (
    <details className="chat-period">
      <summary>
        <span>Analisar período · {periodLabel(context)}</span>
      </summary>
      <div className="chat-period-presets" aria-label="Duração da análise">
        {[1, 3, 6, 12].map((count) => (
          <button
            key={count}
            type="button"
            aria-pressed={period.months.length === count}
            onClick={() => {
              try {
                apply(shiftMonth(context.month, 1 - count), context.month);
              } catch {
                setError("Não foi possível selecionar este intervalo.");
              }
            }}
          >
            {count === 1 ? "Um mês" : count + " meses"}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply(start, end);
        }}
      >
        <div className="chat-period-fields">
          <label>
            De
            <input
              id="assistantRangeStart"
              type="month"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              id="assistantRangeEnd"
              type="month"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="supporting-text">Até 12 meses de gastos registrados.</p>
        {error && (
          <p role="alert" className="chat-period-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--tertiary">
          Aplicar período
        </button>
      </form>
    </details>
  );
}
