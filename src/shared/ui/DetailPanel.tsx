import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { containDialogFocus } from "./dialog";

/** Read-only workspace inspector. The existing modal manager owns focus/scroll. */
export function DetailPanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose(): void;
  children: ReactNode;
}) {
  const id = useId().replace(/:/g, "");
  const dialog = useRef<HTMLDialogElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const close = () => closeHandler.current();
    const leave = () => window.AppUI.closeModal(node.id);
    node.addEventListener("close", close);
    window.addEventListener("gastos:viewchange", leave);
    window.AppUI.openModal(node.id);
    return () => {
      node.removeEventListener("close", close);
      window.removeEventListener("gastos:viewchange", leave);
      window.AppUI.closeModal(node.id);
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      id={"workspaceDetail-" + id}
      className="app-modal workspace-detail"
      aria-labelledby={id + "Title"}
      aria-describedby={id + "Subtitle"}
      onKeyDown={containDialogFocus}
      data-backdrop-close="true"
    >
      <header className="workspace-detail__heading">
        <div>
          <p id={id + "Subtitle"}>{subtitle}</p>
          <h2 id={id + "Title"}>{title}</h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          aria-label="Fechar detalhes"
          onClick={() => window.AppUI.closeModal(dialog.current!.id)}
        >
          Fechar
        </button>
      </header>
      <div className="workspace-detail__body">{children}</div>
    </dialog>,
    document.body,
  );
}
