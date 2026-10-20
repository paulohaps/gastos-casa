import { useRef } from "react";

export type WorkspaceSection = "today" | "activity" | "analysis";
const sections = [
  ["today", "Agora"],
  ["activity", "Movimentações"],
  ["analysis", "Análises"],
] as const;

export function WorkspaceSections({
  value,
  onChange,
}: {
  value: WorkspaceSection;
  onChange(value: WorkspaceSection): void;
}) {
  const group = useRef<HTMLDivElement>(null);
  return (
    <div
      className="workspace-sections"
      role="tablist"
      aria-label="Área de trabalho"
      ref={group}
    >
      {sections.map(([id, label], index) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={"workspaceTab-" + id}
          aria-selected={value === id}
          aria-controls="workspacePanel"
          tabIndex={value === id ? 0 : -1}
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            let next: number | undefined;
            if (event.key === "ArrowRight")
              next = (index + 1) % sections.length;
            if (event.key === "ArrowLeft")
              next = (index + sections.length - 1) % sections.length;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = sections.length - 1;
            if (next !== undefined) {
              event.preventDefault();
              onChange(sections[next]![0]);
              group.current?.querySelectorAll("button")[next]?.focus();
            }
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
