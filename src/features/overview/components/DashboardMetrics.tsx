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
    <div className="premium-metrics" aria-label="Indicadores financeiros">
      <MetricCard
        label="Total de gastos"
        icon="wallet"
        tone="green"
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
        icon="house"
        tone="purple"
        value={
          own === null || (personal && incomplete) ? "—" : money(own / 100)
        }
        note={
          personal
            ? "Cofre selecionado · só você"
            : "Valor pago, não sua responsabilidade"
        }
      >
        <small>
          {personal
            ? "Gastos da sua seleção pessoal"
            : "Responsabilidade compartilhada indisponível"}
        </small>
      </MetricCard>
      <MetricCard
        label={
          other
            ? "Pago por " + other.split(" ")[0] + " na Casa"
            : "Outra pessoa · compartilhado"
        }
        icon="layers"
        value={otherPaid === null ? "—" : money(otherPaid / 100)}
        note={
          filters.type === "personal"
            ? "Não se aplica ao seu cofre privado"
            : "Valor pago, não responsabilidade"
        }
      >
        <small>Divisão por pessoa não informada</small>
      </MetricCard>
      <MetricCard
        label="Saldo líquido de acertos"
        icon="check"
        tone="warning"
        value="—"
        note={
          filters.type === "personal"
            ? "Não se aplica a gastos pessoais"
            : "Saldo confirmado indisponível"
        }
      >
        <small>Pagamentos não entram nas despesas</small>
      </MetricCard>
    </div>
  );
}
