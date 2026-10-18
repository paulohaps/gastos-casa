import { DetailPanel } from "../../../shared/ui/DetailPanel";
import { TransactionList } from "./TransactionList";
import { safeTotal } from "../../../../js/core/financial-selection.mjs";
import { formatCurrency as money } from "../../../shared/finance/currency";
import type { OverviewState } from "../types";
import type { DashboardSelection } from "../useDashboardSelection";
import type { FinancialFilters } from "../filters";

export type OverviewDetail = "transactions" | "responsibility" | "balance";

export function OverviewDetails({
  kind,
  state,
  view,
  filters,
  onClose,
  onOpenPersonal,
}: {
  kind: OverviewDetail;
  state: OverviewState;
  view: DashboardSelection;
  filters: FinancialFilters;
  onClose(): void;
  onOpenPersonal(): void;
}) {
  const balance = view.balance;
  const paid = safeTotal(
    view.rows.filter(
      (row) => row.scope === "house" && row.usuario === state.owner,
    ),
  );
  const title =
    kind === "balance"
      ? "Entenda seus acertos"
      : kind === "responsibility"
        ? "Sua participação"
        : "Movimentações da seleção";
  return (
    <DetailPanel
      title={title}
      subtitle={
        state.period +
        " · " +
        (filters.type === "personal"
          ? "Pessoal · só você"
          : filters.type === "all"
            ? "Casa + seu cofre"
            : "Casa")
      }
      onClose={onClose}
    >
      {balance && kind !== "transactions" && (
        <>
          <dl className="inspector-facts">
            <div>
              <dt>Minha parte nas despesas</dt>
              <dd>{money(balance.responsibilityCents / 100)}</dd>
            </div>
            <div>
              <dt>Pago por mim em despesas</dt>
              <dd>{paid === null ? "Indisponível" : money(paid / 100)}</dd>
            </div>
          </dl>
          <p className="inspector-note">
            Sua parte vem da divisão da Casa. O valor pago mostra quem adiantou
            as despesas; os pagamentos de acerto são transferências e não
            aumentam os gastos.
          </p>
          <section
            className="inspector-section"
            aria-label="Saldos separados por método"
          >
            <h3>O que falta acertar</h3>
            <ul className="inspector-balances">
              {balance.balances.map((row) => (
                <li key={row.month + row.method}>
                  <span>
                    {row.method}
                    <small>
                      {row.direction === "payable"
                        ? "Você deve a " + balance.otherPerson.split(" ")[0]
                        : row.direction === "receivable"
                          ? balance.otherPerson.split(" ")[0] + " deve a você"
                          : "Tudo quite"}
                    </small>
                  </span>
                  <strong>{money(row.amountCents / 100)}</strong>
                </li>
              ))}
            </ul>
            <p className="inspector-note">
              Dinheiro e Vale não se compensam automaticamente. O saldo já
              considera os pagamentos registrados neste período.
            </p>
          </section>
          <section className="inspector-section">
            <h3>Pagamentos registrados</h3>
            {state.payments?.filter(
              (row) => !filters.method || row.formaPagamento === filters.method,
            ).length ? (
              <ul className="inspector-payments">
                {state.payments
                  .filter(
                    (row) =>
                      !filters.method || row.formaPagamento === filters.method,
                  )
                  .map((row, index) => (
                    <li key={index}>
                      <span>
                        {row.pagador.split(" ")[0]} →{" "}
                        {row.recebedor.split(" ")[0]}
                        <small>{row.formaPagamento}</small>
                      </span>
                      <strong>{money(row.valor)}</strong>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="inspector-note">
                Nenhum pagamento registrado nesta seleção.
              </p>
            )}
          </section>
          <a
            className="btn btn--secondary"
            href="#casa"
            data-app-nav="casa"
            data-house-link="acertos"
          >
            Abrir central de acertos →
          </a>
        </>
      )}
      {(!balance || kind === "transactions") && (
        <>
          <dl className="inspector-facts">
            <div>
              <dt>Total da seleção</dt>
              <dd>
                {view.total === null ? "Indisponível" : money(view.total / 100)}
              </dd>
            </div>
          </dl>
          {kind === "responsibility" && (
            <p className="inspector-note">
              {filters.type === "personal"
                ? "Gastos do seu cofre privado. Não entram nos acertos da Casa."
                : "Esta seleção mostra valores pagos. A responsabilidade compartilhada exige a Casa sem filtros de categoria, pagador ou busca."}
            </p>
          )}
          <p className="inspector-note">
            {view.rows.length} movimentações na seleção. Prévia das cinco mais
            recentes.
          </p>
          <TransactionList rows={view.rows} id="inspectorTransactions" />
          {filters.type === "personal" ? (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                onClose();
                onOpenPersonal();
              }}
            >
              Abrir histórico pessoal →
            </button>
          ) : (
            <a
              className="btn btn--secondary"
              href="#casa"
              data-app-nav="casa"
              data-house-link="despesas"
            >
              Abrir histórico da Casa →
            </a>
          )}
        </>
      )}
    </DetailPanel>
  );
}
