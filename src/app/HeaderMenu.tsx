import { useEffect, useRef, type ReactNode } from "react";

/** One set of account controls: inline on desktop, a disclosure on mobile. */
export function HeaderMenu({ children }: { children: ReactNode }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const node = disclosure.current!;
    const mobile = window.matchMedia("(max-width: 900px)");
    const summary = node.querySelector("summary")!;
    const close = (restoreFocus = false) => {
      if (!mobile.matches || !node.open) return;
      node.open = false;
      if (restoreFocus && summary.getClientRects().length) summary.focus();
    };
    const resize = () => {
      const focused = node.contains(document.activeElement);
      node.open = !mobile.matches;
      if (focused) {
        if (mobile.matches) summary.focus();
        else node.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !node.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        close(true);
    };
    const navigation = () => close(node.contains(document.activeElement));
    resize();
    mobile.addEventListener("change", resize);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("gastos:viewchange", navigation);
    window.addEventListener("gastos:sessioncleared", navigation);
    return () => {
      mobile.removeEventListener("change", resize);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("gastos:viewchange", navigation);
      window.removeEventListener("gastos:sessioncleared", navigation);
    };
  }, []);
  return (
    <details
      className="header-menu"
      ref={disclosure}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("[data-entry-open]")
        ) {
          disclosure.current!.open = false;
          disclosure.current!.querySelector("summary")?.focus({
            preventScroll: true,
          });
        }
      }}
    >
      <summary aria-label="Menu da conta" aria-controls="headerAccountActions">
        <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </summary>
      <div className="header-menu__panel" id="headerAccountActions">
        {children}
      </div>
    </details>
  );
}
