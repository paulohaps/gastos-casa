import type { FinancialRow } from "../../../../js/core/financial-selection.mjs";
import { safeTotal } from "../../../../js/core/financial-selection.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import { DetailPanel } from "../../../shared/ui/DetailPanel";

export function ExpenseInspector({
  row,
  period,
  onClose,
  onManage,
}: {
  row: FinancialRow;
  period: string;
  onClose(): void;
  onManage(): void;
}) {
  const amount = safeTotal([row]);
  const date = row.data.includes("/")
    ? row.data
    : row.data.split("-").reverse().join("/");
  const ask = () => {
    onClose();
    window.GastosNavigation.show("assistente");
    window.dispatchEvent(
      new CustomEvent("gastos:assistantrequest", {
        detail: {
          context: {
            scope: "house",
            month: period.split("/").reverse().join("-"),
          },
          text:
            "Analise a despesa compartilhada " +
            JSON.stringify(row.descricao) +
            " de " +
            date +
            ", no valor de " +
            (amount === null
              ? "valor indisponível"
              : formatCurrency(amount / 100)) +
            ". Considere os gastos da Casa nesse mês e explique seu impacto sem presumir recorrência.",
        },
      }),
    );
  };
  return (
    <DetailPanel
      title={row.descricao}
      subtitle={
        period + " · " + (row.scope === "house" ? "Casa" : "Pessoal · só você")
      }
      onClose={onClose}
    >
      <p className="expense-inspector-amount">
        {amount === null ? "Valor indisponível" : formatCurrency(amount / 100)}
      </p>
      <dl className="expense-inspector-facts">
        <div>
          <dt>Data</dt>
          <dd>{date}</dd>
        </div>
        <div>
          <dt>Categoria</dt>
          <dd>{row.categoria}</dd>
        </div>
        <div>
          <dt>{row.scope === "house" ? "Quem pagou" : "Visibilidade"}</dt>
          <dd>
            {row.scope === "house" ? row.usuario || "Indisponível" : "Só você"}
          </dd>
        </div>
        {row.scope === "house" && (
          <div>
            <dt>Pagamento</dt>
            <dd>{row.formaPagamento || "Indisponível"}</dd>
          </div>
        )}
      </dl>
      <button type="button" className="btn btn--secondary" onClick={onManage}>
        {row.scope === "house"
          ? "Gerenciar no histórico da Casa"
          : "Gerenciar no meu cofre"}{" "}
        →
      </button>
      {row.scope === "house" && amount !== null && (
        <button type="button" className="btn btn--ghost" onClick={ask}>
          Analisar esta despesa no chat
        </button>
      )}
    </DetailPanel>
  );
}
