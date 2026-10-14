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
      <section className="home-summary" aria-labelledby="homeTitle">
        <header className="home-heading">
          <div>
            <h1 id="homeTitle">Resumo do mês</h1>
            <p className="view-panel-description">
              Gastos da casa e limite pessoal, separados.
            </p>
          </div>
          <span
            className="home-period"
            id="homePeriod"
            aria-label="Período dos gastos da casa"
          >
            {state.period || "Carregando período"}
          </span>
        </header>
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
              <Icon name="check" /> Para revisar
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
      </section>
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
        <section className="home-activity" aria-labelledby="homeMovementsTitle">
          <div className="section-heading">
            <div>
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
                  <span className="home-expense-date">
                    {expense.data.split("/").slice(0, 2).join("/")}
                  </span>
                  <span>
                    <strong>{expense.descricao}</strong>
                    <small>
                      {expense.categoria} · {expense.usuario}
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
          className="home-distribution"
          aria-labelledby="homeDistributionTitle"
        >
          <div className="section-heading">
            <div>
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
