import type { FinancialFilters } from "../../../js/core/financial-selection.mjs";
export type { FinancialFilters };
export const initialFilters: FinancialFilters = {
  category: "",
  person: "",
  method: "",
  type: "house",
  query: "",
};
export function createFilterStore() {
  let state = initialFilters;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: Partial<FinancialFilters>) {
      state = { ...state, ...next };
      if (state.type === "personal")
        state = { ...state, person: "", method: "" };
      listeners.forEach((listener) => listener());
    },
    reset() {
      state = { ...initialFilters };
      listeners.forEach((listener) => listener());
    },
  };
}
