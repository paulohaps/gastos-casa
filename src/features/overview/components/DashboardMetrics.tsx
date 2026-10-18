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
  onInspect,
}: {
  state: OverviewState;
  filters: FinancialFilters;
  view: DashboardSelection;
  onInspect(kind: "transactions" | "responsibility" | "balance"): void;
}) {
  const { incomplete, total, personalTotal, rows } = view;
  const personal = filters.type !== "house";
  const paidBy = (name: string | undefined) => {
    if (!name) return null;
    return safeTotal(
      rows.filter((row) => row.scope === "house" && row.usuario === name),
    );
  };
  const paid = paidBy(state.owner);
  const own = personal ? personalTotal : paid;
  return (
    <>
      <div className="premium-metrics" aria-label="Indicadores financeiros">
        <MetricCard
          label="Total de gastos"
          id="homeHouseTotal"
          onInspect={
            !incomplete && total !== null
              ? () => onInspect("transactions")
              : undefined
          }
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
          onInspect={
            !incomplete && total !== null
              ? () => onInspect("responsibility")
              : undefined
          }
          label={
            filters.type === "personal"
              ? "Referência mensal do Cofre"
              : personal
                ? "Meus gastos pessoais"
                : view.balance
                  ? "Minha parte nas despesas"
                  : "Pago por mim na Casa"
          }
          value={
            filters.type === "personal"
              ? state.walletValue
              : view.balance
                ? money(view.balance.responsibilityCents / 100)
                : own === null || (personal && incomplete)
                  ? "—"
                  : money(own / 100)
          }
          note={
            filters.type === "personal"
              ? state.walletNote
              : personal
                ? "Cofre selecionado · só você"
                : view.balance
                  ? "Divisão igual da Casa · " + state.period
                  : "Valor pago, não sua responsabilidade"
          }
        />
        {filters.type !== "personal" && (
          <MetricCard
            label="Pago por mim em despesas"
            value={paid === null ? "—" : money(paid / 100)}
            note="Não inclui transferências de acerto"
            onInspect={
              !incomplete && total !== null
                ? () => onInspect("responsibility")
                : undefined
            }
          />
        )}
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
