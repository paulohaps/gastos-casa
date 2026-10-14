import { safeTotal } from "../../../../js/core/financial-selection.mjs";
import type { FinancialRow } from "../../../../js/core/financial-selection.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import { EmptyState } from "../../../shared/ui/States";
export function TransactionList({ rows }: { rows: FinancialRow[] }) {
  const displayAmount = (row: FinancialRow) => {
    const value = safeTotal([row]);
    return value === null ? "Valor indisponível" : formatCurrency(value / 100);
  };
  const dateKey = (row: FinancialRow) =>
    row.data.includes("/") ? row.data.split("/").reverse().join("-") : row.data;
  return (
    <div id="homeRecentExpenses">
      {rows.length ? (
        [...rows]
          .sort((a, b) => dateKey(b).localeCompare(dateKey(a)))
          .slice(0, 5)
          .map((row) => (
            <article className="premium-transaction" key={row.scope + row.id}>
              <span
                className={"transaction-scope transaction-scope--" + row.scope}
                aria-label={row.scope === "house" ? "Compartilhado" : "Pessoal"}
              >
                {row.scope === "house" ? "C" : "P"}
              </span>
              <div>
                <strong>{row.descricao}</strong>
                <small>
                  {row.categoria} ·{" "}
                  {row.scope === "house" ? row.usuario : "Só você"} ·{" "}
                  {row.data.includes("/")
                    ? row.data
                    : row.data.split("-").reverse().join("/")}
                </small>
              </div>
              <strong>{displayAmount(row)}</strong>
            </article>
          ))
      ) : (
        <EmptyState message="Nenhuma movimentação corresponde à seleção." />
      )}
    </div>
  );
}
