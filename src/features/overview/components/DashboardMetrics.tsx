import { MetricCard } from "../../../shared/ui/MetricCard";
import { formatCurrency as money } from "../../../shared/finance/currency";
import { safeTotal } from "../../../../js/core/financial-selection.mjs";
import type { OverviewState } from "../types";
import type { FinancialFilters } from "../filters";
import type { DashboardSelection } from "../useDashboardSelection";
export function DashboardMetrics({
  state,
  filters,
  view,
}: {
  state: OverviewState;
  filters: FinancialFilters;
  view: DashboardSelection;
}) {
  const { incomplete, total, personalTotal, rows } = view;
  const personal = filters.type !== "house";
  const paidBy = (name: string | undefined) => {
    if (!name) return null;
    return safeTotal(
      rows.filter((row) => row.scope === "house" && row.usuario === name),
    );
  };
  const own = personal ? personalTotal : paidBy(state.owner);
  return (
    <>
      <div className="premium-metrics" aria-label="Indicadores financeiros">
        <MetricCard
          label="Total de gastos"
          id="homeHouseTotal"
          value={incomplete || total === null ? "—" : money(total / 100)}
          note={
            filters.type === "house"
              ? "Compartilhados · " + state.period
              : filters.type === "personal"
                ? state.walletName + " · só você"
                : "Casa + cofre selecionado · " + state.period
          }
        />
        <MetricCard
          label={
            personal
              ? "Meus gastos pessoais"
              : view.balance
                ? "Minha parte nas despesas"
                : "Pago por mim na Casa"
          }
          value={
            view.balance
              ? money(view.balance.responsibilityCents / 100)
              : own === null || (personal && incomplete)
                ? "—"
                : money(own / 100)
          }
          note={
            personal
              ? "Cofre selecionado · só você"
              : view.balance
                ? "Divisão igual da Casa · " + state.period
                : "Valor pago, não sua responsabilidade"
          }
        />
        <MetricCard
          label={
            "Você deve" +
            (view.balance ? " a " + view.balance.otherPerson.split(" ")[0] : "")
          }
          id="homePayable"
          value={view.balance ? money(view.balance.payableCents / 100) : "—"}
          note={
            view.balance
              ? "Ainda a pagar · " + state.period
              : "Consulte a Casa sem filtros de despesa"
          }
        />
        <MetricCard
          label={
            view.balance
              ? view.balance.otherPerson.split(" ")[0] + " deve a você"
              : "Você tem a receber"
          }
          id="homeReceivable"
          value={view.balance ? money(view.balance.receivableCents / 100) : "—"}
          note={
            view.balance
              ? "Ainda a receber · " + state.period
              : "Saldo compartilhado indisponível nesta seleção"
          }
        />
      </div>
      <details className="metric-definitions">
        <summary>Sobre os indicadores</summary>
        <p>
          Valor pago não é responsabilidade financeira. A Casa usa divisão igual
          por método; o centavo indivisível cabe a Paulo Henrique. Com filtros
          de categoria, pagador ou busca, exibimos apenas valores pagos.
        </p>
        <p>
          Os saldos mostram o que falta após os pagamentos registrados, apenas
          no mês selecionado. Dinheiro e Vale não se compensam automaticamente.
          Seu cofre é privado e não entra na divisão.
        </p>
      </details>
    </>
  );
}
