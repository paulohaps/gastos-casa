import type { ReactNode } from "react";
import { parseResponseBlocks } from "../../../js/core/response-format.mjs";

// Small text-only formatter. Model output is never interpreted as HTML.
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("`") && part.endsWith("`") ? (
        <code key={index}>{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );
}
export function ResponseText({
  content,
  formatted,
}: {
  content: string;
  formatted: boolean;
}) {
  if (!formatted) return <p className="chat-message-text">{content}</p>;
  const blocks = parseResponseBlocks(content);
  return (
    <div className="chat-message-text chat-response">
      {blocks.map((block, index) => {
        if (block.kind === "table")
          return (
            <div
              className="chat-table-wrap"
              key={index}
              tabIndex={0}
              role="region"
              aria-label="Tabela da resposta"
            >
              <table className="chat-table">
                <caption className="sr-only">
                  Dados apresentados pelo Assistente
                </caption>
                <thead>
                  <tr>
                    {block.header.map((cell, i) => (
                      <th key={i} scope="col">
                        {inline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{inline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (block.kind === "heading")
          return <h3 key={index}>{inline(block.lines.join("\n"))}</h3>;
        if (block.kind === "ul")
          return (
            <ul key={index}>
              {block.lines.map((line, i) => (
                <li key={i}>{inline(line)}</li>
              ))}
            </ul>
          );
        if (block.kind === "ol")
          return (
            <ol key={index} start={block.start}>
              {block.lines.map((line, i) => (
                <li key={i}>{inline(line)}</li>
              ))}
            </ol>
          );
        return <p key={index}>{inline(block.lines.join("\n"))}</p>;
      })}
    </div>
  );
}
