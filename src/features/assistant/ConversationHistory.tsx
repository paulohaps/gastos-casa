import { useRef } from "react";
import type { Message } from "./contracts";
export function ConversationHistory({
  messages,
  onSelect,
}: {
  messages: Message[];
  onSelect(index: number): void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const questions = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === "user");
  return (
    <details className="chat-history" ref={details}>
      <summary>
        Histórico{questions.length > 0 && <span>{questions.length}</span>}
      </summary>
      <div className="chat-history-list">
        <strong>Nesta conversa</strong>
        {questions.length ? (
          <ol>
            {questions.map(({ message, index }, position) => (
              <li key={index}>
                <button
                  type="button"
                  aria-label={"Ir para pergunta: " + message.content}
                  onClick={() => {
                    onSelect(index);
                    if (details.current) details.current.open = false;
                  }}
                >
                  <span>{position + 1}</span>
                  <span>{message.content}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>Nenhuma pergunta neste contexto e período.</p>
        )}
      </div>
    </details>
  );
}
