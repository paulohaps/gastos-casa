import { GoalEditor } from "./GoalEditor";
import { formatCurrency as money } from "../../shared/finance/currency";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { WalletController } from "./controller";
import { Icon } from "../../shared/ui/Icon";

export function Wallets({ controller }: { controller: WalletController }) {
  const state = useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
    ),
    [all, setAll] = useState(false);
  const wallet = state.wallets.find((w) => w.id === state.selected),
    plan = state.plan,
    ready = state.phase === "success" || state.phase === "empty";
  const protectedBudget = window.GastosWalletPlanner.protect(
    plan,
    wallet?.goal || null,
  );
  const forecast = window.GastosWalletPlanner.forecast(plan);
  const percent = plan?.budget
    ? Math.round((plan.spent / plan.budget) * 100)
    : 0;
  useEffect(() => {
    setAll(false);
  }, [state.selected, state.month]);
  useEffect(() => {
    window.GastosCharts.render("walletCategoryChart", {
      expenses: state.items,
      context:
        (wallet?.nome || "Cofre pessoal") + " · " + state.month + " · privado",
    });
  }, [state.items, state.month, wallet?.nome]);
  const ask = () => {
    window.GastosNavigation.show("assistente");
    window.dispatchEvent(
      new CustomEvent("gastos:assistantrequest", {
        detail: {
          context: {
            scope: "wallet",
            walletId: state.selected,
            month: state.month,
          },
          text: "Quanto posso gastar hoje sem atrapalhar minha meta?",
        },
      }),
    );
  };
  return (
    <>
      <p
        id="walletStatus"
        role={state.phase === "error" ? "alert" : "status"}
        aria-live="polite"
        className={state.phase === "error" ? "wallet-error" : "sr-only"}
      >
        {state.status}
        {state.phase === "error" && (
          <button
            type="button"
            className="btn btn--tertiary"
            onClick={() => void controller.load()}
          >
            Tentar novamente
          </button>
        )}
      </p>
      {state.phase === "loading" && (
        <div
          className="wallet-loading"
          aria-label="Carregando cofre"
          role="status"
        >
          <span className="skeleton" />
          <span className="skeleton" />
          Carregando seu cofre…
        </div>
      )}
      <div
        className="wallet-empty"
        id="walletEmptyView"
        hidden={state.wallets.length > 0 || !ready}
      >
        <Icon name="wallet" />
        <h3>Vamos organizar seus gastos?</h3>
        <p>
          Escolha quanto quer gastar por mês e acompanhe seus gastos pessoais.
        </p>
        <button
          className="btn btn--primary"
          id="walletEmptyCreate"
          type="button"
          onClick={controller.openCreate}
        >
          Criar minha primeira carteira
        </button>
        <small>Visível só para você. Separado das despesas da casa.</small>
      </div>
      <div
        id="walletControls"
        hidden={!wallet}
        aria-busy={state.phase === "loading"}
      >
        <div className="vault-overview">
          <div className="wallet-detail-heading">
            <div>
              <p className="eyebrow">SÓ VOCÊ</p>
              <h3 id="walletSelectedName">{wallet?.nome || ""}</h3>
            </div>
            <div className="wallet-detail-actions">
              <div className="wallet-selection" id="walletSelection">
                <label className="field" hidden={state.wallets.length < 2}>
                  <span>Carteira</span>
                  <select
                    id="walletSelect"
                    value={state.selected}
                    onChange={(e) => controller.select(e.target.value)}
                  >
                    {state.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Mês dos gastos</span>
                  <input
                    type="month"
                    id="walletMonth"
                    required
                    value={state.month}
                    onChange={(e) => controller.changeMonth(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="btn btn--ghost"
                id="walletCreateToggle"
                type="button"
                onClick={controller.openCreate}
              >
                Nova carteira
              </button>
            </div>
          </div>
          <div className="vault-balance">
            <article className="vault-available">
              <span>Limite restante no mês</span>
              <strong id="walletRemaining">
                {plan
                  ? plan.remaining === null
                    ? "Sem limite"
                    : money(plan.remaining)
                  : "—"}
              </strong>
              <small id="walletBudgetLabel">
                {plan?.budget
                  ? "De um limite de " + money(plan.budget)
                  : "Defina um limite para acompanhar"}
              </small>
              <button
                className="btn btn--primary"
                id="walletAddExpense"
                type="button"
                disabled={!ready}
                onClick={controller.addExpense}
              >
                Registrar gasto
              </button>
            </article>
            <article>
              <span>Gasto no mês</span>
              <strong id="walletSpent">{plan ? money(plan.spent) : "—"}</strong>
              <small id="walletExpenseCount">
                {state.items.length} lançamentos neste mês
              </small>
            </article>
          </div>
          <div className="vault-progress">
            <div>
              <span id="walletProgressLabel">
                {plan?.budget
                  ? percent + "% do limite utilizado"
                  : "Defina um limite mensal"}
              </span>
            </div>
            <progress
              id="walletProgress"
              aria-label="Limite mensal utilizado"
              max={100}
              value={Math.min(percent, 100)}
              className={percent > 100 ? "is-over" : ""}
            />
          </div>
          <p
            className="budget-notice"
            role="status"
            id="walletBudgetAlert"
            hidden={!plan?.budget || plan.spent <= plan.budget}
          >
            Limite ultrapassado em{" "}
            {money(Math.max(0, (plan?.spent || 0) - (plan?.budget || 0)))}.
            Revise os próximos gastos.
          </p>
          <div className="wallet-today">
            <div>
              <span>Referência para hoje</span>
              <strong id="walletDailyValue">
                {!plan
                  ? "—"
                  : protectedBudget.daily === null
                    ? "Sem referência"
                    : money(protectedBudget.daily)}
              </strong>
              <small>
                {protectedBudget.reserve
                  ? "Com " +
                    money(protectedBudget.reserve) +
                    " protegidos para sua meta."
                  : "Limite dividido pelos dias restantes. Confira suas próximas contas."}
              </small>
            </div>
            <button
              className="btn btn--tertiary"
              id="walletSimulatorOpen"
              type="button"
              disabled={!plan}
              onClick={controller.openSimulator}
            >
              Posso gastar?
            </button>
          </div>
          <div className="vault-primary-actions">
            <button
              className="btn btn--tertiary"
              id="walletViewExpenses"
              type="button"
              onClick={() => {
                const node = document.getElementById("walletMovements");
                node?.scrollIntoView({ block: "start", behavior: "instant" });
                node?.focus({ preventScroll: true });
              }}
            >
              Ver gastos
            </button>
            <button
              className="btn btn--tertiary"
              id="walletEditLimit"
              type="button"
              onClick={controller.editLimit}
            >
              Ajustar limite
            </button>
          </div>
        </div>
        <div className="vault-content">
          <section
            className="vault-movements"
            id="walletMovements"
            tabIndex={-1}
            aria-labelledby="walletMovementsTitle"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">SEUS LANÇAMENTOS</p>
                <h3 id="walletMovementsTitle">
                  {all ? "Gastos deste mês" : "Últimos gastos"}
                </h3>
              </div>
              <button
                className="text-link"
                id="walletRefresh"
                type="button"
                onClick={() => void controller.load()}
              >
                Atualizar
              </button>
            </div>
            <div id="walletExpenseList">
              {state.items.length === 0 ? (
                <div className="vault-expense-empty">
                  {ready
                    ? "Nenhum gasto pessoal neste mês. Toque em Registrar gasto para começar."
                    : "Os gastos aparecem quando o mês terminar de carregar."}
                </div>
              ) : (
                (all ? state.items : state.items.slice(0, 5)).map((item) => (
                  <article className="wallet-expense" key={item.id}>
                    <span>
                      <strong>{item.descricao}</strong>
                      <small>
                        {item.data.split("-").reverse().join("/")} ·{" "}
                        {item.categoria}
                      </small>
                    </span>
                    <strong className="vault-expense-value">
                      {money(item.valor)}
                    </strong>
                    <div className="form-actions">
                      <button
                        className="btn btn--ghost btn--compact"
                        aria-label={"Editar " + item.descricao}
                        onClick={() => controller.editExpense(item)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn--ghost btn--compact"
                        aria-label={"Excluir " + item.descricao}
                        onClick={() => void controller.removeExpense(item)}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            {state.items.length > 5 && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setAll(!all)}
              >
                {all
                  ? "Mostrar só os últimos"
                  : "Ver todos os " + state.items.length + " gastos"}
              </button>
            )}
          </section>
          <section className="wallet-goal" aria-labelledby="walletGoalHeading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SEU PRÓXIMO PLANO</p>
                <h3 id="walletGoalHeading">
                  {wallet?.goal?.name || "Guarde espaço para uma meta"}
                </h3>
              </div>
              <GoalEditor controller={controller} state={state} />
            </div>
            {wallet?.goal ? (
              <>
                <p>
                  Meta de {money(wallet.goal.target)} até{" "}
                  {wallet.goal.deadline.split("-").reverse().join("/")}
                </p>
                <p id="walletGoalProtected">
                  {!plan ? (
                    "Carregue o mês para consultar a reserva."
                  ) : (
                    <>
                      {money(protectedBudget.reserve)} protegidos neste mês ·{" "}
                      {protectedBudget.available === null
                        ? "Defina um limite mensal"
                        : money(protectedBudget.available) +
                          " livres no orçamento"}
                    </>
                  )}
                </p>
                {protectedBudget.shortfall > 0 && (
                  <p role="status" className="budget-notice">
                    Faltam {money(protectedBudget.shortfall)} no limite restante
                    para proteger toda a reserva.
                  </p>
                )}
                <button
                  type="button"
                  className="text-link"
                  disabled={!ready}
                  onClick={ask}
                >
                  Perguntar ao Assistente
                </button>
              </>
            ) : (
              <p className="supporting-text">
                Escolha um objetivo e proteja parte do seu limite antes de
                gastar.
              </p>
            )}
          </section>
          <details className="vault-advisor">
            <summary className="vault-advisor-heading">
              <Icon name="spark" />
              <span>Análises e dicas para economizar</span>
            </summary>
            <div className="wallet-forecast">
              <div>
                <span>Referência por dia</span>
                <strong id="walletDailyReference">
                  {protectedBudget.daily === null
                    ? "Sem referência"
                    : money(protectedBudget.daily)}
                </strong>
              </div>
              <div>
                <span>Se mantiver o ritmo</span>
                <strong id="walletForecastValue">
                  {forecast
                    ? money(forecast.projected)
                    : "Ainda sem estimativa"}
                </strong>
              </div>
            </div>
            <p className="supporting-text" id="walletForecastNote">
              {forecast
                ? `Estimativa baseada em ${forecast.elapsed} dias. Contas concentradas no início do mês podem mudar esse ritmo.`
                : "Estimativa disponível no mês atual após 7 dias e pelo menos 3 gastos."}
            </p>
            <details className="wallet-chart-details">
              <summary>Para onde foi meu dinheiro?</summary>
              <p className="supporting-text">
                Toque em uma categoria para conferir os gastos.
              </p>
              <div
                id="walletCategoryChart"
                className="explore-chart"
                aria-label="Gastos pessoais por categoria"
              />
            </details>
            <div className="wallet-signals" id="walletSignals">
              {plan?.signals.length ? (
                plan.signals.map((s) => <p key={s.type}>{s.action}</p>)
              ) : (
                <p>Sem sinais relevantes com os dados disponíveis.</p>
              )}
            </div>
            <button
              type="button"
              id="walletAiButton"
              className="btn btn--tertiary"
              disabled={
                !plan?.signals.length ||
                state.explanationStatus === "Preparando sua análise…"
              }
              onClick={() => void controller.explain()}
            >
              {state.aiConfigured
                ? "Aprofundar com IA"
                : "Entender as recomendações"}
            </button>
            <p className="supporting-text" id="walletAiStatus">
              {state.explanationStatus ||
                "Recomendações baseadas nos seus lançamentos."}
            </p>
            <p id="walletAiText" role="status">
              {state.explanation}
            </p>
            <button
              type="button"
              className="text-link"
              onClick={() => window.GastosNavigation.show("ajustes")}
            >
              Configurar minha IA
            </button>
          </details>
        </div>
      </div>
    </>
  );
}
