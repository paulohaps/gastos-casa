import { useMemo } from "react";
import { settlementSummary } from "../../../js/core/settlement-summary.mjs";
import {
  safeTotal,
  selectExpenses,
} from "../../../js/core/financial-selection.mjs";
import type { OverviewState } from "./types";
import type { FinancialFilters } from "./filters";
export function useDashboardSelection(
  state: OverviewState,
  filters: FinancialFilters,
) {
  const rows = useMemo(
    () => selectExpenses([...state.expenses, ...state.personal], filters),
    [state.expenses, state.personal, filters],
  );
  const total = safeTotal(rows);
  const needsPersonal =
    filters.type !== "house" && !filters.person && !filters.method;
  const incomplete =
    needsPersonal &&
    (state.personalPhase === "loading" || state.personalPhase === "error");
  const people = [
    ...new Set(
      state.expenses
        .map((row) => row.usuario)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const categories = [
    ...new Set(
      [...state.expenses, ...state.personal].map((row) => row.categoria),
    ),
  ].sort();
  const other = people.find((name) => name !== state.owner);
  const personalTotal = safeTotal(
    rows.filter((row) => row.scope === "personal"),
  );
  const houseTotal = safeTotal(rows.filter((row) => row.scope === "house"));
  const unfiltered =
    filters.type === "house" &&
    !filters.category &&
    !filters.person &&
    !filters.method &&
    !filters.query;
  const period = state.period.split("/").reverse().join("-");
  // Expense filters cannot be applied to transfers: they have no expense category.
  const balanceCompatible =
    filters.type === "house" &&
    !filters.category &&
    !filters.person &&
    !filters.query;
  const balance = useMemo(() => {
    if (
      !balanceCompatible ||
      state.payments?.atomic !== true ||
      state.payments.complete !== true ||
      !["success", "empty"].includes(state.phase)
    )
      return null;
    try {
      return settlementSummary(
        state.expenses.filter(
          (row) => !filters.method || row.formaPagamento === filters.method,
        ),
        state.payments.filter(
          (row) => !filters.method || row.formaPagamento === filters.method,
        ),
        { owner: state.owner, months: [period] },
      );
    } catch {
      return null;
    }
  }, [
    balanceCompatible,
    state.expenses,
    state.payments,
    state.phase,
    state.owner,
    period,
    filters.method,
  ]);
  const personalHistory = [
    ...state.personalHistory,
    { month: period, phase: state.personalPhase, rows: state.personal },
  ];
  return {
    rows,
    total,
    needsPersonal,
    incomplete,
    people,
    categories,
    other,
    personalTotal,
    houseTotal,
    unfiltered,
    period,
    personalHistory,
    balance,
    balanceCompatible,
  };
}
export type DashboardSelection = ReturnType<typeof useDashboardSelection>;
