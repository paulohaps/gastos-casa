import type { ReactNode } from "react";

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
type Block = {
  kind: "paragraph" | "heading" | "ul" | "ol";
  lines: string[];
  start?: number;
};
export function ResponseText({
  content,
  formatted,
}: {
  content: string;
  formatted: boolean;
}) {
  if (!formatted) return <p className="chat-message-text">{content}</p>;
  const blocks: Block[] = [];
  let current: Block | undefined;
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      current = undefined;
      continue;
    }
    const heading = /^#{1,3}\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*(\d{1,3})[.)]\s+(.+)$/.exec(line);
    const kind = heading
      ? "heading"
      : bullet
        ? "ul"
        : ordered
          ? "ol"
          : "paragraph";
    if (
      !current ||
      current.kind !== kind ||
      kind === "heading" ||
      (ordered &&
        Number(ordered[1]) !== (current.start ?? 1) + current.lines.length)
    ) {
      current = {
        kind,
        lines: [],
        ...(ordered ? { start: Number(ordered[1]) } : {}),
      };
      blocks.push(current);
    }
    current.lines.push(heading?.[1] ?? bullet?.[1] ?? ordered?.[2] ?? line);
  }
  return (
    <div className="chat-message-text chat-response">
      {blocks.map((block, index) => {
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
