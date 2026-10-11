import { MonthlyAnalysis } from "./MonthlyAnalysis";
import { useChatViewport } from "./useChatViewport";
import { useEffect, useRef, useState } from "react";
import { containDialogFocus } from "../../shared/ui/dialog";
import { PeriodSelector } from "./PeriodSelector";
import {
  analysisPeriod,
  shiftMonth,
} from "../../../js/core/analysis-period.mjs";
import { DepthMark } from "../../shared/ui/DepthMark";
import { Icon } from "../../shared/ui/Icon";
import { useAssistant } from "./useAssistant";
import type { AssistantPorts, Context, Message } from "./contracts";
const prompts = [
  ["Onde mais gastei?", "Onde mais gastei neste mês?"],
  ["Comparar os meses", "Compare meus gastos com o mês anterior."],
  ["Quero economizar", "Como posso economizar com base nos meus gastos?"],
] as const;
function MessageCard({
  message,
  context,
  ports,
}: {
  message: Message;
  context: Context;
  ports: AssistantPorts;
}) {
  const [reviewing, setReviewing] = useState(false),
    [failure, setFailure] = useState("");
  const reviewable =
    message.role === "user" &&
    /^(?:paguei|gastei|comprei|(?:quero\s+)?(?:registrar|lançar|lancar))\b/i.test(
      message.content,
    ) &&
    /\d/.test(message.content) &&
    !message.content.includes("?") &&
    message.content.length <= 500;
  return (
    <article className={"chat-message chat-message--" + message.role}>
      <strong className="chat-message-author">
        {message.role === "user" ? "Você" : "Assistente"}
      </strong>
      {message.analysis && (
        <MonthlyAnalysis
          analysis={message.analysis}
          disabled={reviewing}
          onOpen={async (month) => {
            setReviewing(true);
            setFailure("");
            try {
              const { startMonth: _, ...scope } = context;
              await ports.openFinance({ ...scope, month }, "expenses");
            } catch (cause) {
              setFailure(
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível abrir os gastos.",
              );
            } finally {
              setReviewing(false);
            }
          }}
        />
      )}
      <p className="chat-message-text">
        {message.content ||
          (message.status === "pending"
            ? "Consultando suas finanças…"
            : message.status === "failed"
              ? "Não foi possível responder."
              : "Resposta interrompida.")}
      </p>
      {message.role === "assistant" &&
        ["failed", "stopped"].includes(message.status ?? "") && (
          <small>
            {message.status === "stopped"
              ? "Resposta interrompida"
              : "Resposta incompleta"}
          </small>
        )}
      {reviewable && !context.startMonth && (
        <button
          type="button"
          className="btn btn--ghost chat-review"
          disabled={reviewing}
          onClick={async () => {
            setReviewing(true);
            setFailure("");
            try {
              await ports.review(message.content, context);
            } catch {
              setFailure("Não foi possível preparar o gasto. Tente novamente.");
            } finally {
              setReviewing(false);
            }
          }}
        >
          Revisar como gasto
        </button>
      )}
      {message.role === "assistant" &&
        message.status === "success" &&
        !context.startMonth && (
          <div className="chat-finance-actions">
            {(
              [
                "expenses",
                ...(context.scope === "wallet" && !context.startMonth
                  ? ["simulate"]
                  : []),
              ] as ("expenses" | "simulate")[]
            ).map((action) => (
              <button
                key={action}
                type="button"
                className="btn btn--tertiary"
                disabled={reviewing}
                onClick={async () => {
                  setReviewing(true);
                  setFailure("");
                  try {
                    await ports.openFinance(context, action);
                  } catch (cause) {
                    setFailure(
                      cause instanceof Error
                        ? cause.message
                        : "Não foi possível abrir. Tente novamente.",
                    );
                  } finally {
                    setReviewing(false);
                  }
                }}
              >
                {action === "expenses" ? "Ver esses gastos" : "Simular compra"}
              </button>
            ))}
          </div>
        )}
      {failure && <p role="alert">{failure}</p>}
    </article>
  );
}
export function Assistant({ ports }: { ports: AssistantPorts }) {
  useChatViewport();
  const chat = useAssistant(ports),
    log = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const pinned = useRef(true),
    previousContext = useRef("");
  const configured = [
    "AI_NOT_CONFIGURED",
    "KEY_REJECTED",
    "MODEL_UNAVAILABLE",
  ].includes(chat.error?.code ?? "");
  const historyProblem =
    chat.phase === "error" || chat.error?.code === "HISTORY_CONFLICT";
  useEffect(() => {
    const key = JSON.stringify(chat.context);
    if (key !== previousContext.current) {
      pinned.current = true;
      previousContext.current = key;
    }
    if (log.current && pinned.current)
      log.current.scrollTop = chat.messages.length
        ? log.current.scrollHeight
        : 0;
  }, [chat.messages, chat.context]);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (
      wasBusy.current &&
      !chat.busy &&
      !window.matchMedia("(pointer: coarse)").matches &&
      window.GastosNavigation.current() === "assistente"
    )
      input.current?.focus({ preventScroll: true });
    wasBusy.current = chat.busy;
  }, [chat.busy]);
  const configure = () => ports.navigate("ajustes");
  return (
    <>
      <header className="chat-heading">
        <div className="chat-heading-title">
          <span className="chat-avatar" aria-hidden="true">
            <Icon name="spark" />
          </span>
          <div>
            <h1 id="assistantTitle">Assistente</h1>
            <p>Uma conversa para cuidar do seu dinheiro.</p>
          </div>
        </div>
        <div className="chat-heading-actions">
          <button
            className="btn btn--ghost"
            id="assistantNew"
            type="button"
            aria-label="Apagar conversa"
            title="Apagar conversa"
            disabled={chat.busy || chat.phase !== "ready"}
            onClick={() =>
              chat.messages.length
                ? dialog.current?.showModal()
                : void chat.clear()
            }
          >
            Apagar
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Configurar conexão de IA"
            title="Configurar IA"
            onClick={configure}
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>
      <div className="chat-context">
        <label htmlFor="assistantContext">Conversar sobre</label>
        <select
          id="assistantContext"
          value={
            chat.context.scope === "house" ? "house" : chat.context.walletId
          }
          onChange={(event) =>
            void chat.changeContext(
              event.target.value === "house"
                ? {
                    scope: "house",
                    month: chat.context.month,
                    ...(chat.context.startMonth
                      ? { startMonth: chat.context.startMonth }
                      : {}),
                  }
                : {
                    scope: "wallet",
                    month: chat.context.month,
                    walletId: event.target.value,
                    ...(chat.context.startMonth
                      ? { startMonth: chat.context.startMonth }
                      : {}),
                  },
            )
          }
        >
          <option value="house">Casa</option>
          {chat.wallets.map((wallet) => (
            <option value={wallet.id} key={wallet.id}>
              Cofre · {wallet.nome}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="assistantMonth">
          Mês da conversa
        </label>
        <input
          id="assistantMonth"
          type="month"
          required
          value={chat.context.month}
          onChange={(event) =>
            void chat.changeContext({
              ...chat.context,
              month: event.target.value,
              ...(chat.context.startMonth && event.target.value
                ? {
                    startMonth: shiftMonth(
                      event.target.value,
                      1 - analysisPeriod(chat.context).months.length,
                    ),
                  }
                : {}),
            })
          }
        />
        <span className="chat-private">
          <Icon name="lock" /> Conversa privada
        </span>
        <PeriodSelector
          context={chat.context}
          onChange={(next) => void chat.changeContext(next)}
        />
      </div>
      <div
        ref={log}
        id="assistantMessages"
        className="chat-messages"
        role="log"
        aria-label="Mensagens da conversa"
        aria-live="off"
        tabIndex={0}
        onScroll={() => {
          if (log.current)
            pinned.current =
              log.current.scrollHeight -
                log.current.scrollTop -
                log.current.clientHeight <
              100;
        }}
      >
        {chat.phase === "loading" && (
          <p role="status" className="supporting-text">
            Carregando sua conversa…
          </p>
        )}
        <div
          id="assistantWelcome"
          className="chat-welcome"
          hidden={chat.messages.length > 0 || chat.phase !== "ready"}
        >
          <DepthMark />
          <h2>Vamos olhar suas finanças?</h2>
          <p>
            Pergunte sobre seus gastos, compare períodos ou planeje seu próximo
            passo.
          </p>
          <div className="assistant-prompts">
            {prompts.map(([label, prompt]) => (
              <button
                key={label}
                data-chat-prompt={prompt}
                type="button"
                onClick={() => void chat.send(false, prompt)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {chat.messages.map((message, index) => (
          <MessageCard
            key={JSON.stringify(chat.context) + ":" + index}
            message={message}
            context={chat.context}
            ports={ports}
          />
        ))}
      </div>
      <div
        id="assistantError"
        className="chat-error"
        role="alert"
        hidden={!chat.error}
      >
        <span id="assistantErrorMessage">{chat.error?.message}</span>
        <button
          className="btn btn--ghost"
          id="assistantRetry"
          type="button"
          hidden={chat.error?.code === "AI_NOT_CONFIGURED"}
          disabled={chat.busy || chat.phase === "loading"}
          onClick={() =>
            historyProblem
              ? void chat.reload()
              : chat.retryAction === "delete"
                ? dialog.current?.showModal()
                : void chat.send(true)
          }
        >
          {historyProblem
            ? "Recarregar histórico"
            : chat.retryAction === "delete"
              ? "Excluir novamente"
              : "Tentar novamente"}
        </button>
        <button
          className="btn btn--ghost"
          id="assistantConfigure"
          type="button"
          hidden={!configured}
          onClick={configure}
        >
          Conectar IA
        </button>
      </div>
      <form
        className="assistant-composer"
        id="assistantComposer"
        onSubmit={(event) => {
          event.preventDefault();
          void chat.send();
        }}
      >
        <label className="sr-only" htmlFor="assistantText">
          Mensagem para o assistente
        </label>
        <textarea
          ref={input}
          id="assistantText"
          maxLength={2000}
          placeholder="Pergunte ou descreva um gasto…"
          required
          rows={2}
          value={chat.text}
          readOnly={chat.busy}
          onChange={(event) => chat.setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              !window.matchMedia("(pointer: coarse)").matches
            ) {
              event.preventDefault();
              void chat.send();
            }
          }}
        />
        <div className="composer-bottom">
          <span id="assistantComposerStatus" role="status" aria-live="polite">
            {chat.status}
          </span>
          <button
            className="btn btn--ghost"
            id="assistantStop"
            type="button"
            hidden={!chat.generating}
            onClick={chat.stop}
          >
            Parar resposta
          </button>
          <button
            aria-label="Enviar mensagem"
            className="composer-send"
            type="submit"
            disabled={chat.busy || chat.phase !== "ready" || historyProblem}
          >
            <Icon name="send" />
          </button>
        </div>
      </form>
      <p className="chat-footnote">
        A IA pode errar. Confira os valores. Até 50 respostas concluídas são
        salvas por contexto e período. Exclua com “Apagar”.
      </p>
      <dialog
        ref={dialog}
        className="chat-delete-dialog"
        aria-labelledby="chatDeleteTitle"
        onKeyDown={containDialogFocus}
      >
        <h2 id="chatDeleteTitle">Começar uma nova conversa?</h2>
        <p>
          O histórico deste período e destino será excluído. Seus gastos
          continuam salvos.
        </p>
        <div className="chat-heading-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => dialog.current?.close()}
          >
            Manter conversa
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              dialog.current?.close();
              void chat.clear();
            }}
          >
            Excluir e começar
          </button>
        </div>
      </dialog>
    </>
  );
}
