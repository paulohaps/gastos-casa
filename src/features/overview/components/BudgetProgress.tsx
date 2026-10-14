import type { Budget } from "../types";
import type { FinancialRow } from "../../../../js/core/financial-selection.mjs";
import { cents, safeTotal } from "../../../../js/core/financial-selection.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import { EmptyState, ErrorState } from "../../../shared/ui/States";
export function BudgetProgress({
  budgets,
  rows,
  category,
}: {
  budgets: Budget[] | null;
  rows: FinancialRow[];
  category: string;
}) {
  if (budgets === null)
    return (
      <ErrorState
        message="Orçamento indisponível. Não foi possível confirmar os limites deste mês."
        retry={() => window.mudarMes()}
      />
    );
  const selected = budgets
    .filter((row) => !category || row.categoria === category)
    .filter((row) => Number(row.valor_limite) > 0);
  if (!selected.length)
    return (
      <EmptyState message="Nenhum limite configurado para esta seleção. Defina o orçamento em Planejamento." />
    );
  return (
    <div className="budget-progress">
      {selected.map((budget) => {
        const spent = safeTotal(
          rows.filter(
            (row) =>
              row.scope === "house" && row.categoria === budget.categoria,
          ),
        );
        let limit: number;
        try {
          limit = cents(budget.valor_limite);
        } catch {
          return (
            <ErrorState
              key={budget.categoria}
              message="Limite inválido. Revise o orçamento."
            />
          );
        }
        if (spent === null)
          return (
            <ErrorState
              key={budget.categoria}
              message="Não foi possível confirmar o consumo desta categoria."
            />
          );
        const percent = (spent / limit) * 100;
        return (
          <div
            key={budget.categoria}
            className={
              percent >= 100 ? "is-over" : percent >= 80 ? "is-near" : ""
            }
          >
            <div>
              <strong>{budget.categoria}</strong>
              <span>
                {formatCurrency(spent / 100)}{" "}
                <small>/ {formatCurrency(limit / 100)}</small>
              </span>
            </div>
            <progress
              value={spent}
              max={limit}
              aria-label={
                budget.categoria + ": " + percent.toFixed(0) + "% do limite"
              }
            />
          </div>
        );
      })}
    </div>
  );
}
