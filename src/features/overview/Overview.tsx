import { formatCurrency as money } from "../../shared/finance/currency";
import { useSyncExternalStore } from "react";
import { DepthMark } from "../../shared/ui/DepthMark";
import { Icon } from "../../shared/ui/Icon";
import type { OverviewController } from "./controller";

export function Overview({ controller }: { controller: OverviewController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  return (
    <>
      <div className="home-heading">
        <div>
          <p className="eyebrow">Tudo no seu ritmo</p>
          <h1>Visão geral</h1>
          <p className="view-panel-description">
            Um mês organizado. Mais espaço para seus planos.
          </p>
        </div>
        <span
          className="home-period"
          id="homePeriod"
          aria-label="Período dos gastos da casa"
        >
          {state.period || "Seu resumo mensal"}
        </span>
      </div>
      <div className="home-stats" data-month-content="">
        <article>
          <DepthMark name="house" />
          <span className="home-stat-label">
            Gastos compartilhados <Icon name="house" />
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
            Conferir gastos da casa →
          </a>
        </article>
        <article>
          <DepthMark name="wallet" />
          <span className="home-stat-label">
            Meu limite restante <Icon name="wallet" />
          </span>
          <strong id="homeWalletRemaining">{state.walletValue}</strong>
          <small id="homeWalletMeta">{state.walletNote}</small>
          <a data-app-nav="carteiras" href="#carteiras">
            Abrir meu cofre →
          </a>
        </article>
      </div>
      <div className="home-workspace" data-month-content="">
        <div className="home-main">
          <section
            className="home-activity surface-card"
            aria-labelledby="homeMovementsTitle"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">MOVIMENTAÇÕES DA CASA</p>
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
                state.expenses.slice(0, 3).map((expense) => (
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
                <p className="supporting-text">
                  {state.total === null
                    ? "Carregando lançamentos…"
                    : "A casa ainda não tem gastos neste mês. Registre o primeiro em Novo gasto."}
                </p>
              )}
            </div>
          </section>
        </div>
        <aside className="home-side">
          <div className="assistant-overview">
            <DepthMark />
            <div className="panel-caption">
              <Icon name="spark" />
              <span>UMA AJUDA NO SEU DIA</span>
            </div>
            <h2>Seu próximo passo, com IA.</h2>
            <p>Pergunte, compare e planeje com seus próprios números.</p>
            <a
              className="btn btn--primary"
              data-app-nav="assistente"
              href="#assistente"
            >
              Conversar com o assistente <Icon name="arrow" />
            </a>
          </div>
          <a
            className="home-attention surface-card"
            data-app-nav="casa"
            href="#casa"
          >
            <span>
              <strong id="homeAttention">{state.attention}</strong>{" "}
              {state.attention === 1 ? "ponto" : "pontos"} de atenção na casa
            </span>
            <Icon name="arrow" />
          </a>
        </aside>
      </div>
    </>
  );
}
