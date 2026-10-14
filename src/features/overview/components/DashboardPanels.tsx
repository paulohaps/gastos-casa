import { ChartCard } from "../../../shared/ui/ChartCard";
import { EmptyState, ErrorState } from "../../../shared/ui/States";
import { formatCurrency as money } from "../../../shared/finance/currency";
import { TransactionList } from "./TransactionList";
import { ExpenseDistribution } from "./ExpenseDistribution";
import { MonthlyTrend } from "./MonthlyTrend";
import { BudgetProgress } from "./BudgetProgress";
import { BalanceSummary } from "./BalanceSummary";
import type { OverviewState } from "../types";
import type { FinancialFilters } from "../filters";
import type { DashboardSelection } from "../useDashboardSelection";
export function DashboardPanels({
  state,
  filters,
  view,
}: {
  state: OverviewState;
  filters: FinancialFilters;
  view: DashboardSelection;
}) {
  const {
    rows,
    total,
    incomplete,
    personalHistory,
    period,
    houseTotal,
    personalTotal,
    unfiltered,
  } = view;
  return (
    <div className="dashboard-grid">
      <ChartCard
        title="Evolução mensal"
        id="trendTitle"
        className="dashboard-wide"
        description="Totais registrados nos últimos quatro meses. O mês em andamento pode estar incompleto."
      >
        <MonthlyTrend
          house={state.history}
          personal={personalHistory}
          filters={filters}
          selected={period}
          personalPhase={state.personalPhase}
        />
      </ChartCard>
      <ChartCard
        title="Gastos por categoria"
        id="homeDistributionTitle"
        description="Selecione uma categoria para conferir os registros."
      >
        {incomplete || total === null ? (
          <EmptyState message="A distribuição aguarda dados completos da seleção." />
        ) : (
          <ExpenseDistribution rows={rows} period={state.period} />
        )}
      </ChartCard>
      <ChartCard
        title="Últimas movimentações"
        id="homeMovementsTitle"
        className="dashboard-wide home-activity"
      >
        <TransactionList rows={rows} />
        <a
          className="dashboard-link text-link"
          data-app-nav={filters.type === "personal" ? "carteiras" : "casa"}
          data-house-link={filters.type === "personal" ? undefined : "despesas"}
          href={filters.type === "personal" ? "#carteiras" : "#casa"}
        >
          Consultar histórico →
        </a>
      </ChartCard>
      <ChartCard
        title="Casa e meu cofre"
        id="scopeTitle"
        description={state.walletName + " · apenas seus gastos pessoais"}
      >
        <div className="scope-comparison">
          <div>
            <span>Casa · seleção</span>
            <strong>
              {filters.type === "personal"
                ? "Fora da seleção"
                : houseTotal === null
                  ? "—"
                  : money(houseTotal / 100)}
            </strong>
          </div>
          <div>
            <span>Meu cofre · seleção</span>
            <strong>
              {filters.type === "house" || filters.person || filters.method
                ? "Fora da seleção"
                : state.personalPhase === "loading"
                  ? "Carregando"
                  : state.personalPhase === "error" || personalTotal === null
                    ? "Indisponível"
                    : money(personalTotal / 100)}
            </strong>
          </div>
        </div>
        <p className="supporting-text">
          Filtros de pagador e método da Casa excluem gastos pessoais, que não
          possuem esses campos.
        </p>
      </ChartCard>
      <ChartCard
        title="Orçamento da Casa"
        id="budgetTitle"
        className="dashboard-wide"
        description="Consumo da seleção sobre os limites configurados para este mês."
      >
        {filters.type === "personal" ? (
          <EmptyState message="Este orçamento se aplica à Casa. Seu limite pessoal está no Cofre." />
        ) : (
          <BudgetProgress
            budgets={state.budgets}
            rows={rows}
            category={filters.category}
          />
        )}
        <a
          className="dashboard-link"
          data-app-nav="casa"
          data-house-link="planejamento"
          href="#casa"
        >
          Gerenciar limites →
        </a>
      </ChartCard>
      <ChartCard title="Referência do Cofre · mês" id="walletBudgetTitle">
        <strong className="wallet-budget-number" id="homeWalletRemaining">
          {state.walletValue}
        </strong>
        <p id="homeWalletMeta" className="supporting-text">
          {state.walletNote}
        </p>
        <a
          className="dashboard-link"
          data-app-nav="carteiras"
          href="#carteiras"
        >
          Abrir meu cofre →
        </a>
      </ChartCard>
      <ChartCard
        title="Pontos de atenção"
        id="attentionTitle"
        className="dashboard-wide"
      >
        {unfiltered && !state.radarAvailable ? (
          <ErrorState
            message="Não foi possível confirmar todas as fontes do radar deste mês."
            retry={() => window.mudarMes()}
          />
        ) : (
          <div className="dashboard-attention">
            <strong id="homeAttention">
              {unfiltered ? state.attention : "—"}
            </strong>
            <p>
              {unfiltered
                ? state.attention
                  ? "Revise os alertas do mês na Casa antes de planejar novas despesas."
                  : "Nenhum alerta identificado no radar deste mês."
                : "O radar da Casa considera o mês completo. Limpe os filtros para consultar a contagem."}
            </p>
          </div>
        )}
        <a className="dashboard-link" data-app-nav="casa" href="#casa">
          Consultar radar da Casa →
        </a>
      </ChartCard>
      <ChartCard title="Pagamentos de acerto" id="balanceTitle">
        {filters.type === "personal" ? (
          <EmptyState message="Acertos pertencem ao espaço compartilhado." />
        ) : (
          <BalanceSummary
            payments={state.payments}
            method={filters.method}
            person={filters.person}
            incompatible={Boolean(filters.category || filters.query)}
          />
        )}
      </ChartCard>
    </div>
  );
}
