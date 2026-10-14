import { formatCurrency as money } from "../../shared/finance/currency";
import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "../../shared/ui/Icon";
import type { OverviewController } from "./controller";

export function Overview({ controller }: { controller: OverviewController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  useEffect(() => {
    window.GastosCharts.render("homeCategoryChart", {
      expenses: state.expenses,
      context: state.period,
    });
  }, [state.expenses, state.period]);
  return (
    <>
      <section className="home-heading" aria-labelledby="homeTitle">
        <div className="home-heading-copy">
          <p className="eyebrow">SEU PAINEL FINANCEIRO</p>
          <h1 id="homeTitle">Clareza para cada escolha.</h1>
          <p className="view-panel-description">
            A casa em equilíbrio. Seus planos em movimento.
          </p>
          <a
            className="home-hero-link"
            data-app-nav="assistente"
            href="#assistente"
          >
            <Icon name="spark" /> Explorar com o Assistente{" "}
            <Icon name="arrow" />
          </a>
        </div>
        <div className="finance-sculpture" aria-hidden="true">
          <span />
          <span />
          <span />
          <Icon name="layers" />
        </div>
        <span
          className="home-period"
          id="homePeriod"
          aria-label="Período dos gastos da casa"
        >
          <Icon name="clock" />
          {state.period || "Seu resumo mensal"}
        </span>
      </section>
      <div className="home-stats" data-month-content="">
        <article>
          <span className="home-stat-label">
            <Icon name="house" /> Gastos compartilhados
          </span>
          <strong id="homeHouseTotal">
            {state.total === null ? "—" : money(state.total)}
          </strong>
          <small id="homeHouseMeta">
            {state.total === null
              ? "Carregando o mês selecionado"
              : state.expenses.length + " gastos compartilhados neste mês"}
          </small>
          <a data-app-nav="casa" href="#casa">
            Conferir gastos da casa <Icon name="arrow" />
          </a>
        </article>
        <article>
          <span className="home-stat-label">
            <Icon name="wallet" /> Meu limite restante
          </span>
          <strong id="homeWalletRemaining">{state.walletValue}</strong>
          <small id="homeWalletMeta">{state.walletNote}</small>
          <a data-app-nav="carteiras" href="#carteiras">
            Abrir meu cofre <Icon name="arrow" />
          </a>
        </article>
        <article className="home-priority">
          <span className="home-stat-label">
            <Icon name="spark" /> Radar da casa
          </span>
          <strong id="homeAttention">
            {state.total === null ? "—" : state.attention}
          </strong>
          <small>
            {state.attention === 1
              ? "ponto para revisar neste mês"
              : "pontos para revisar neste mês"}
          </small>
          <a data-app-nav="casa" href="#casa">
            Ver pontos de atenção <Icon name="arrow" />
          </a>
        </article>
      </div>
      <section className="home-shortcuts" aria-label="Atalhos financeiros">
        <button type="button" data-entry-open="">
          <Icon name="plus" />
          <span>Registrar gasto</span>
          <Icon name="arrow" />
        </button>
        <a data-app-nav="casa" data-house-link="planejamento" href="#casa">
          <Icon name="clock" />
          <span>Planejar o mês</span>
          <Icon name="arrow" />
        </a>
        <a data-app-nav="casa" data-house-link="acertos" href="#casa">
          <Icon name="check" />
          <span>Conferir acertos</span>
          <Icon name="arrow" />
        </a>
      </section>
      <div className="home-workspace" data-month-content="">
        <section
          className="home-activity surface-card"
          aria-labelledby="homeMovementsTitle"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">ATIVIDADE RECENTE</p>
              <h2 className="section-title" id="homeMovementsTitle">
                Últimos gastos
              </h2>
            </div>
            <a
              className="text-link"
              data-app-nav="casa"
              data-house-link="despesas"
              href="#casa"
            >
              Ver todos <Icon name="arrow" />
            </a>
          </div>
          <div id="homeRecentExpenses">
            {state.expenses.length ? (
              state.expenses.slice(0, 5).map((expense) => (
                <article className="home-expense-row" key={expense.id}>
                  <span className="home-expense-marker" aria-hidden="true">
                    {expense.categoria.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{expense.descricao}</strong>
                    <small>
                      {expense.categoria} · {expense.data} · {expense.usuario}
                    </small>
                  </span>
                  <strong className="home-expense-value">
                    {money(expense.valor)}
                  </strong>
                </article>
              ))
            ) : (
              <div className="home-empty">
                <Icon name="house" />
                <p>
                  {state.total === null
                    ? "Carregando lançamentos…"
                    : "A casa ainda não tem gastos neste mês. Registre o primeiro em Novo gasto."}
                </p>
              </div>
            )}
          </div>
        </section>
        <section
          className="home-distribution surface-card"
          aria-labelledby="homeDistributionTitle"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">DESTINO DO DINHEIRO</p>
              <h2 className="section-title" id="homeDistributionTitle">
                Gastos por categoria
              </h2>
            </div>
            <Icon name="layers" />
          </div>
          <p className="supporting-text">
            Toque em uma categoria para conferir os lançamentos.
          </p>
          <div
            id="homeCategoryChart"
            className="explore-chart"
            aria-label="Distribuição dos gastos da casa"
          />
        </section>
      </div>
    </>
  );
}
