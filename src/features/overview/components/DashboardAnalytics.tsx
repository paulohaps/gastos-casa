import type { WorkspaceSection } from "./WorkspaceSections";
import type { OverviewState } from "../types";
import type { FinancialFilters } from "../filters";
import type { DashboardSelection } from "../useDashboardSelection";
import { ChartCard } from "../../../shared/ui/ChartCard";
import { EmptyState, ErrorState } from "../../../shared/ui/States";
import { formatCurrency as money } from "../../../shared/finance/currency";
import { ExpenseDistribution } from "./ExpenseDistribution";
import { MonthlyTrend } from "./MonthlyTrend";
import { BudgetProgress } from "./BudgetProgress";
export function DashboardAnalytics({
  state,
  filters,
  view,
  onOpenPersonal,
  section,
}: {
  state: OverviewState;
  filters: FinancialFilters;
  view: DashboardSelection;
  onOpenPersonal(): void;
  section: WorkspaceSection;
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
    <div hidden={section !== "analysis"} className="workspace-analytics">
      <div className="dashboard-analysis">
        <ChartCard
          title="Evolução mensal"
          id="trendTitle"
          className="dashboard-trend"
          description="Quatro meses · selecione um ponto ou mês"
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
          className="dashboard-distribution"
          progressive
        >
          {incomplete || total === null ? (
            <EmptyState message="A distribuição aguarda dados completos da seleção." />
          ) : (
            <ExpenseDistribution rows={rows} period={state.period} />
          )}
        </ChartCard>
      </div>
      <div className="dashboard-secondary">
        <ChartCard
          title="Casa e meu cofre"
          id="scopeTitle"
          description={state.walletName + " · só você"}
          className="dashboard-scope"
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
          {(filters.person || filters.method) && (
            <p className="supporting-text">
              Pagador e método da Casa não se aplicam aos gastos pessoais.
            </p>
          )}
        </ChartCard>
        <ChartCard
          title="Orçamento da Casa"
          id="budgetTitle"
          className="dashboard-budget"
          progressive
          description="Consumo da seleção / limite mensal"
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
        <ChartCard
          title="Referência do Cofre · mês"
          id="walletBudgetTitle"
          className="dashboard-wallet"
        >
          <strong className="wallet-budget-number" id="homeWalletRemaining">
            {state.walletValue}
          </strong>
          <p id="homeWalletMeta" className="supporting-text">
            {state.walletNote}
          </p>
          <button
            type="button"
            className="dashboard-link text-link"
            onClick={onOpenPersonal}
          >
            Abrir meu cofre →
          </button>
        </ChartCard>
        <ChartCard
          title="Pontos de atenção"
          id="attentionTitle"
          className="dashboard-radar"
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
                    ? "Alerta no radar do mês. Confira os detalhes na Casa."
                    : "Nenhum alerta no radar deste mês."
                  : "Radar disponível para o mês completo, sem filtros."}
              </p>
            </div>
          )}
          <a className="dashboard-link" data-app-nav="casa" href="#casa">
            Consultar radar da Casa →
          </a>
        </ChartCard>
      </div>
    </div>
  );
}
