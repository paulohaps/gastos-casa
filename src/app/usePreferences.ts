import { useSyncExternalStore, useState } from "react";
declare global {
  interface Window {
    GastosTheme: {
      current(): "dark" | "light";
      set(value: "dark" | "light"): void;
    };
  }
}
const subscribe = (listener: () => void) => {
  window.addEventListener("gastos:themechange", listener);
  return () => window.removeEventListener("gastos:themechange", listener);
};
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, window.GastosTheme.current);
  return {
    theme,
    toggle: () => window.GastosTheme.set(theme === "dark" ? "light" : "dark"),
  };
}
export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("gastos_sidebar_v1") === "collapsed";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(
          "gastos_sidebar_v1",
          next ? "collapsed" : "expanded",
        );
      } catch {}
      return next;
    });
  return { collapsed, toggle };
}
