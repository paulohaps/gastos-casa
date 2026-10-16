import {
  safeTotal,
  type FinancialRow,
} from "../../../../js/core/financial-selection.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import { EmptyState } from "../../../shared/ui/States";
export function TransactionList({ rows }: { rows: FinancialRow[] }) {
  const dateKey = (row: FinancialRow) =>
    row.data.includes("/") ? row.data.split("/").reverse().join("-") : row.data;
  if (!rows.length)
    return (
      <div id="homeRecentExpenses">
        <EmptyState
          title="Nenhuma movimentação"
          message="Registre uma despesa ou ajuste os filtros do período."
          action={{
            label: "Registrar uma despesa",
            run: () => window.AppUI.openModal("entryChoiceDialog"),
          }}
        />
      </div>
    );
  return (
    <div id="homeRecentExpenses" className="transaction-table-wrap">
      <table className="transaction-table">
        <caption className="sr-only">Últimas movimentações da seleção</caption>
        <thead>
          <tr>
            <th scope="col">Descrição</th>
            <th scope="col" className="transaction-desktop">
              Categoria
            </th>
            <th scope="col" className="transaction-desktop">
              Pagador / destino
            </th>
            <th scope="col" className="transaction-desktop">
              Data
            </th>
            <th scope="col" className="transaction-amount">
              Valor
            </th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort((a, b) => dateKey(b).localeCompare(dateKey(a)))
            .slice(0, 5)
            .map((row) => {
              const amount = safeTotal([row]);
              const date = row.data.includes("/")
                ? row.data
                : row.data.split("-").reverse().join("/");
              const owner = row.scope === "house" ? row.usuario : "Só você";
              return (
                <tr className="premium-transaction" key={row.scope + row.id}>
                  <td>
                    <strong>{row.descricao}</strong>
                    <small className="transaction-mobile">
                      {row.categoria} · {owner} · {date}
                    </small>
                  </td>
                  <td className="transaction-desktop">{row.categoria}</td>
                  <td className="transaction-desktop">{owner}</td>
                  <td className="transaction-desktop">
                    <time dateTime={dateKey(row)}>{date}</time>
                  </td>
                  <td className="transaction-amount">
                    <strong>
                      {amount === null
                        ? "Valor indisponível"
                        : formatCurrency(amount / 100)}
                    </strong>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
