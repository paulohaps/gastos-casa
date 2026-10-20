import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  window.addEventListener("gastos:viewchange", notify);
  return () => window.removeEventListener("gastos:viewchange", notify);
};
const getSnapshot = () => document.body.dataset.appView || "resumo";

export function useAppView() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
