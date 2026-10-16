import type { SettlementSummary } from "../../../../js/core/settlement-summary.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import { EmptyState, ErrorState } from "../../../shared/ui/States";
export function BalanceSummary({
  balance,
  compatible,
  period,
}: {
  balance: SettlementSummary | null;
  compatible: boolean;
  period: string;
}) {
  if (!compatible)
    return (
      <EmptyState message="Para conferir quem deve a quem, selecione Casa e limpe categoria, pagador e busca. Acertos não têm categoria de despesa." />
    );
  if (!balance)
    return (
      <div className="balance-summary">
        <ErrorState
          message="Pagamentos indisponíveis. Não foi possível confirmar o saldo deste mês."
          retry={() => window.mudarMes()}
        />
      </div>
    );
  const pending = balance.balances.filter((row) => row.amountCents > 0);
  return (
    <section className="balance-summary" aria-label="Quem deve a quem">
      <div className="balance-summary__heading">
        <strong>Quem deve a quem</strong>
        <span>{period} · após pagamentos registrados</span>
      </div>
      {pending.length ? (
        <ul className="balance-summary__rows">
          {pending.map((row) => (
            <li key={row.month + row.method}>
              <span>
                {row.direction === "payable"
                  ? "Você deve a " + balance.otherPerson.split(" ")[0]
                  : balance.otherPerson.split(" ")[0] + " deve a você"}
              </span>
              <strong>{formatCurrency(row.amountCents / 100)}</strong>
              <span>{row.method}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Ninguém deve neste mês. Tudo quite.</p>
      )}
      <a href="#casa" data-app-nav="casa" data-house-link="acertos">
        Conferir e registrar pagamentos →
      </a>
    </section>
  );
}
