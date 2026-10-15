import { useState } from "react";
import { MonthlyAnalysis } from "./MonthlyAnalysis";
import { ResponseText } from "./ResponseText";
import type { AssistantPorts, Context, Message } from "./contracts";
export function MessageCard({
  message,
  id,
  context,
  ports,
}: {
  message: Message;
  id: string;
  context: Context;
  ports: AssistantPorts;
}) {
  const [reviewing, setReviewing] = useState(false),
    [failure, setFailure] = useState(""),
    [copying, setCopying] = useState(false),
    [copyStatus, setCopyStatus] = useState("");
  const financeActions: ("expenses" | "simulate")[] = [
    ...(!message.analysis ? ["expenses" as const] : []),
    ...(context.scope === "wallet" ? ["simulate" as const] : []),
  ];
  const reviewable =
    message.role === "user" &&
    /^(?:paguei|gastei|comprei|(?:quero\s+)?(?:registrar|lançar|lancar))\b/i.test(
      message.content,
    ) &&
    /\d/.test(message.content) &&
    !message.content.includes("?") &&
    message.content.length <= 500;
  return (
    <article
      id={id}
      tabIndex={-1}
      className={"chat-message chat-message--" + message.role}
    >
      <strong className="chat-message-author">
        {message.role === "user" ? "Você" : "Assistente"}
      </strong>
      <ResponseText
        content={
          message.content ||
          (message.status === "pending"
            ? "Consultando suas finanças…"
            : message.status === "failed"
              ? "Não foi possível responder."
              : "Resposta interrompida.")
        }
        formatted={message.role === "assistant"}
      />
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
        !context.startMonth &&
        financeActions.length > 0 && (
          <div className="chat-finance-actions">
            {financeActions.map((action) => (
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
      {message.role === "assistant" && message.status === "success" && (
        <div className="chat-copy">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={copying}
            onClick={async () => {
              setCopying(true);
              setCopyStatus("");
              try {
                await navigator.clipboard.writeText(message.content);
                setCopyStatus("Resposta copiada.");
              } catch {
                setCopyStatus(
                  "Não foi possível copiar. Selecione o texto da resposta.",
                );
              } finally {
                setCopying(false);
              }
            }}
          >
            Copiar resposta
          </button>
          <span role="status">{copyStatus}</span>
        </div>
      )}
      {failure && <p role="alert">{failure}</p>}
    </article>
  );
}
