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
  const { incomplete, total, personalTotal, rows, other } = view;
  const personal = filters.type !== "house";
  const paidBy = (name: string | undefined) => {
    if (!name) return null;
    return safeTotal(
      rows.filter((row) => row.scope === "house" && row.usuario === name),
    );
  };
  const own = personal ? personalTotal : paidBy(state.owner);
  const otherPaid = filters.type === "personal" ? null : paidBy(other);
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
          label={personal ? "Meus gastos pessoais" : "Pago por mim na Casa"}
          value={
            own === null || (personal && incomplete) ? "—" : money(own / 100)
          }
          note={
            personal ? "Cofre selecionado · só você" : "Divisão não informada"
          }
        />
        <MetricCard
          label={
            other
              ? "Pago por " + other.split(" ")[0] + " na Casa"
              : "Outra pessoa · compartilhado"
          }
          value={otherPaid === null ? "—" : money(otherPaid / 100)}
          note={
            filters.type === "personal"
              ? "Não se aplica ao seu cofre privado"
              : "Despesas compartilhadas"
          }
        />
        <MetricCard
          label="Saldo líquido de acertos"
          value="—"
          note={
            filters.type === "personal"
              ? "Não se aplica a gastos pessoais"
              : "Saldo não confirmado"
          }
        />
      </div>
      <details className="metric-definitions">
        <summary>Sobre os indicadores</summary>
        <p>
          Valor pago não é responsabilidade financeira. Responsabilidade
          compartilhada indisponível: a divisão por pessoa não está informada.
        </p>
        <p>
          Pagamentos de acerto não entram nas despesas. O saldo líquido
          permanece indisponível até ser confirmado. Gastos pessoais consideram
          somente seu cofre selecionado.
        </p>
      </details>
    </>
  );
}
