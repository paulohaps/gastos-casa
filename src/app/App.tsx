import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

const features = new Map<string, { host: HTMLElement; content: ReactNode }>();
let root: ReturnType<typeof createRoot> | null = null;
function Application() {
  return (
    <>
      <AppShell />
      {[...features].map(([key, feature]) =>
        createPortal(feature.content, feature.host, key),
      )}
    </>
  );
}
export function startApplication() {
  const host = document.getElementById("reactAppRoot");
  if (!host) throw new Error("Raiz do aplicativo ausente.");
  if (root) return;
  root = createRoot(host);
  flushSync(() => root!.render(<Application />));
}
/** Temporary portals preserve legacy layout ownership while features are migrated. */
export function mountFeature(host: HTMLElement, content: ReactNode) {
  if (!root) throw new Error("Aplicativo não inicializado.");
  features.set(host.id, { host, content });
  flushSync(() => root!.render(<Application />));
}
