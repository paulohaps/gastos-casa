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
      let updated = { ...state, ...next };
      if (updated.type === "personal")
        updated = { ...updated, person: "", method: "" };
      const keys: (keyof FinancialFilters)[] = [
        "category",
        "person",
        "method",
        "type",
        "query",
      ];
      if (keys.every((key) => state[key] === updated[key])) return;
      state = updated;
      listeners.forEach((listener) => listener());
    },
    reset() {
      state = { ...initialFilters };
      listeners.forEach((listener) => listener());
    },
  };
}
