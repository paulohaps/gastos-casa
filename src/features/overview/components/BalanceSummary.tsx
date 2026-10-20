import type { SettlementSummary } from "../../../../js/core/settlement-summary.mjs";
import { formatCurrency } from "../../../shared/finance/currency";
import type { DashboardSelection } from "../useDashboardSelection";
export function BalanceSummary({
  balance,
  compatible,
  period,
  onInspect,
  status,
}: {
  balance: SettlementSummary | null;
  compatible: boolean;
  period: string;
  onInspect(): void;
  status: DashboardSelection["balanceStatus"];
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
  if (!balance) {
    const message = !compatible
      ? "Acertos são calculados pelo mês completo."
      : status === "upgrade"
        ? "Acertos precisam de uma atualização do serviço."
        : status === "incomplete"
          ? "Faltam pagamentos para confirmar os acertos."
          : status === "invalid"
            ? "Há um registro de acerto que precisa de revisão."
            : "Acertos não carregaram.";
    return (
      <section
        className="balance-summary balance-summary--unavailable"
        aria-label="Disponibilidade dos acertos"
      >
        <div
          className="settlement-notice"
          role={compatible ? "status" : undefined}
        >
          <div>
            <strong>{message}</strong>
            <p>
              {!compatible
                ? "Acertos não têm categoria de despesa. Limpe os filtros para consultar."
                : "Não é possível confirmar o saldo deste mês."}
            </p>
          </div>
          {compatible && status !== "upgrade" && (
            <button
              type="button"
              className="text-link"
              onClick={() => window.mudarMes()}
            >
              Tentar novamente
            </button>
          )}
        </div>
        {unavailable}
      </section>
    );
  }
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
