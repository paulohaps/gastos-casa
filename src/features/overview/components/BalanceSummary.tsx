import type { Payment } from "../types";
import { safeTotal } from "../../../../js/core/financial-selection.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import { EmptyState, ErrorState } from "../../../shared/ui/States";
export function BalanceSummary({
  payments,
  method,
  person,
  incompatible,
}: {
  payments: Payment[] | null;
  method: string;
  person: string;
  incompatible: boolean;
}) {
  if (incompatible)
    return (
      <EmptyState message="Pagamentos não têm categoria de despesa. Limpe a busca e a categoria para consultar os acertos deste mês." />
    );
  if (payments === null)
    return (
      <div className="balance-summary">
        <ErrorState
          message="Pagamentos indisponíveis. Não foi possível consultar os registros deste mês."
          retry={() => window.mudarMes()}
        />
      </div>
    );
  const rows = payments?.filter(
    (row) =>
      (!method || row.formaPagamento === method) &&
      (!person || row.pagador === person),
  );
  const total = rows ? safeTotal(rows) : null;
  return (
    <div className="balance-summary">
      <strong>
        {total === null
          ? "Pagamentos indisponíveis"
          : formatCurrency(total / 100) + " em pagamentos registrados"}
      </strong>
      <p>
        Acertos ficam separados das despesas. O saldo líquido ainda não está
        confirmado.
      </p>
      <a href="#casa" data-app-nav="casa" data-house-link="acertos">
        Conferir acertos
      </a>
    </div>
  );
}
