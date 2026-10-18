import type { SettlementSummary } from "../../../../js/core/settlement-summary.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import { EmptyState, ErrorState } from "../../../shared/ui/States";
export function BalanceSummary({
  balance,
  compatible,
  period,
  onInspect,
}: {
  balance: SettlementSummary | null;
  compatible: boolean;
  period: string;
  onInspect(): void;
}) {
  const unavailable = (
    <div className="balance-unavailable">
      <span>
        Você deve <strong id="homePayable">—</strong>
      </span>
      <span>
        A receber <strong id="homeReceivable">—</strong>
      </span>
    </div>
  );
  if (!compatible)
    return (
      <div className="balance-summary">
        {unavailable}
        <EmptyState message="Para conferir quem deve a quem, selecione Casa e limpe categoria, pagador e busca. Acertos não têm categoria de despesa." />
      </div>
    );
  if (!balance)
    return (
      <div className="balance-summary">
        {unavailable}
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
      {!pending.length && <p>Ninguém deve neste mês. Tudo quite.</p>}
      <ul className="balance-summary__rows">
        {(["payable", "receivable"] as const).map((direction) => {
          const methods = balance.balances
            .filter((row) => row.direction === direction && row.amountCents > 0)
            .map((row) => row.method);
          const amount =
            direction === "payable"
              ? balance.payableCents
              : balance.receivableCents;
          return (
            <li key={direction}>
              <button
                type="button"
                className="balance-summary__inspect"
                onClick={onInspect}
                aria-label={
                  direction === "payable"
                    ? "Entender o que você deve"
                    : "Entender o que você tem a receber"
                }
              >
                <span>
                  {direction === "payable"
                    ? "Você deve a " + balance.otherPerson.split(" ")[0]
                    : balance.otherPerson.split(" ")[0] + " deve a você"}
                </span>
                <strong
                  id={
                    direction === "payable" ? "homePayable" : "homeReceivable"
                  }
                >
                  {formatCurrency(amount / 100)}
                </strong>
                <span>
                  {methods.length ? methods.join(" + ") : "Sem pendências"}
                </span>
                <span className="balance-summary__hint">Ver cálculo ↗</span>
              </button>
            </li>
          );
        })}
      </ul>
      <a href="#casa" data-app-nav="casa" data-house-link="acertos">
        Conferir e registrar pagamentos →
      </a>
    </section>
  );
}
