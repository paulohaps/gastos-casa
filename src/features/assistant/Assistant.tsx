import { ConversationHistory } from "./ConversationHistory";
import { periodLabel } from "../../../js/core/analysis-period.mjs";
import { MessageCard } from "./MessageCard";
import { useChatViewport } from "./useChatViewport";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { containDialogFocus } from "../../shared/ui/dialog";
import { PeriodSelector } from "./PeriodSelector";
import {
  analysisPeriod,
  shiftMonth,
} from "../../../js/core/analysis-period.mjs";
import { Icon } from "../../shared/ui/Icon";
import { useAssistant } from "./useAssistant";
import type { AssistantPorts } from "./contracts";
const prompts = [
  ["Onde mais gastei?", "Onde mais gastei neste mês?"],
  ["Comparar os meses", "Compare meus gastos com o mês anterior."],
  ["Quero economizar", "Como posso economizar com base nos meus gastos?"],
] as const;
export function Assistant({ ports }: { ports: AssistantPorts }) {
  useChatViewport();
  const chat = useAssistant(ports),
    log = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [away, setAway] = useState(false);
  const pinned = useRef(true),
    previousContext = useRef("");
  const configured = [
    "AI_NOT_CONFIGURED",
    "KEY_REJECTED",
    "MODEL_UNAVAILABLE",
  ].includes(chat.error?.code ?? "");
  const historyProblem =
    chat.phase === "error" || chat.error?.code === "HISTORY_CONFLICT";
  useLayoutEffect(() => {
    const key = JSON.stringify(chat.context);
    if (key !== previousContext.current) {
      pinned.current = true;
      setAway(false);
      previousContext.current = key;
    }
    if (log.current && pinned.current)
      log.current.scrollTop = chat.messages.length
        ? log.current.scrollHeight
        : 0;
  }, [chat.messages, chat.context, away]);
  useEffect(() => {
    const node = log.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current)
        node.scrollTop = chat.messages.length ? node.scrollHeight : 0;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [chat.messages.length]);
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
  const configure = () =>
    window.GastosNavigation.showAndReveal("ajustes", "#aiSettingsPanel", {
      focusSelector: "#aiProvider",
    });
  const walletId =
    chat.context.scope === "wallet" ? chat.context.walletId : null;
  const destination =
    chat.context.scope === "house"
      ? "Casa"
      : chat.wallets.find((wallet) => wallet.id === walletId)?.nome ||
        "Cofre pessoal";
  const suggestions = prompts.map(
    ([label, prompt]) =>
      [
        label,
        label === "Comparar os meses" && chat.context.startMonth
          ? "Como meus gastos evoluíram entre os meses do período selecionado?"
          : prompt.replace("neste mês", "no período selecionado") +
            (chat.context.scope === "wallet"
              ? " Considere apenas este cofre."
              : ""),
      ] as const,
  );
  const send = (retry = false, text?: string) => {
    pinned.current = true;
    setAway(false);
    void chat.send(retry, text);
  };
  return (
    <>
      <header className="chat-heading">
        <div className="chat-heading-title">
          <a
            className="chat-exit"
            href="#resumo"
            data-app-nav="resumo"
            aria-label="Voltar ao Início"
          >
            <Icon name="home" />
            <span>Início</span>
          </a>
          <div>
            <h1 id="assistantTitle">Assistente</h1>
            <p>Conversa privada · {destination}</p>
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
        <PeriodSelector
          context={chat.context}
          onChange={(next) => void chat.changeContext(next)}
        />
        <ConversationHistory
          messages={chat.messages}
          onSelect={(index) => {
            const node = document.getElementById("assistantMessage-" + index);
            if (log.current && node) {
              pinned.current = false;
              setAway(true);
              log.current.scrollTop +=
                node.getBoundingClientRect().top -
                log.current.getBoundingClientRect().top;
              node.focus({ preventScroll: true });
            }
          }}
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
          if (log.current) {
            pinned.current =
              log.current.scrollHeight -
                log.current.scrollTop -
                log.current.clientHeight <
              100;
            setAway(!pinned.current);
          }
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
          <h2>Analisar {destination === "Casa" ? "a Casa" : destination}</h2>
          <p>
            {periodLabel(chat.context)} ·{" "}
            {chat.context.scope === "house"
              ? "Despesas compartilhadas"
              : "Só seus gastos pessoais"}
          </p>
          <div className="assistant-prompts">
            {suggestions.map(([label, prompt]) => (
              <button
                key={label}
                data-chat-prompt={prompt}
                type="button"
                onClick={() => send(false, prompt)}
              >
                <span>{label}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>
        {chat.messages.map((message, index) => (
          <MessageCard
            key={JSON.stringify(chat.context) + ":" + index}
            id={"assistantMessage-" + index}
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
                : send(true)
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
      {away && chat.messages.length > 0 && (
        <button
          type="button"
          className="chat-latest"
          onClick={() => {
            if (log.current) {
              pinned.current = true;
              log.current.scrollTop = log.current.scrollHeight;
              log.current.focus({ preventScroll: true });
              setAway(false);
            }
          }}
        >
          Ir à última resposta ↓
        </button>
      )}
      <form
        className="assistant-composer"
        id="assistantComposer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
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
          readOnly={
            chat.busy || chat.phase === "loading" || chat.phase === "idle"
          }
          onChange={(event) => chat.setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              !window.matchMedia("(pointer: coarse)").matches
            ) {
              event.preventDefault();
              send();
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
      <p className="chat-footnote">A IA pode errar. Confira os valores.</p>
      <dialog
        ref={dialog}
        className="chat-delete-dialog"
        aria-labelledby="chatDeleteTitle"
        onKeyDown={containDialogFocus}
      >
        <h2 id="chatDeleteTitle">Começar uma nova conversa?</h2>
        <p>
          São mantidas até 50 respostas por período e destino. O histórico desta
          conversa será excluído ao confirmar. Seus gastos continuam salvos.
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
