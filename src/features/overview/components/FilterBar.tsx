import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../../../shared/ui/useMediaQuery";
import { containDialogFocus } from "../../../shared/ui/dialog";
import type { FinancialFilters } from "../filters";
export function FilterBar({
  filters,
  categories,
  people,
  onChange,
  reset,
}: {
  filters: FinancialFilters;
  categories: string[];
  people: string[];
  onChange(next: Partial<FinancialFilters>): void;
  reset(): void;
}) {
  const mobile = useMediaQuery("(max-width: 767px)");
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    const node = dialog.current;
    const close = () => node?.close();
    window.addEventListener("gastos:viewchange", close);
    return () => {
      close();
      window.removeEventListener("gastos:viewchange", close);
    };
  }, [mobile]);
  const value = mobile ? draft : filters;
  const update = (next: Partial<FinancialFilters>) => {
    if (!mobile) return onChange(next);
    setDraft((current) => {
      const updated = { ...current, ...next };
      return updated.type === "personal"
        ? { ...updated, person: "", method: "" }
        : updated;
    });
  };
  const fields = (
    <div className="dashboard-filters">
      <label>
        <span id="dashboardFilterTypeLabel">Tipo de gasto</span>
        <select
          aria-labelledby="dashboardFilterTypeLabel"
          value={value.type}
          onChange={(e) =>
            update({ type: e.target.value as FinancialFilters["type"] })
          }
        >
          <option value="house">Compartilhados</option>
          <option value="personal">Meu cofre</option>
          <option value="all">Casa + meu cofre</option>
        </select>
      </label>
      <label>
        <span id="dashboardFilterCategoryLabel">Categoria</span>
        <select
          aria-labelledby="dashboardFilterCategoryLabel"
          value={value.category}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">Todas as categorias</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        <span id="dashboardFilterPersonLabel">Pagador da casa</span>
        <select
          aria-labelledby="dashboardFilterPersonLabel"
          disabled={value.type === "personal"}
          value={value.person}
          onChange={(e) => update({ person: e.target.value })}
        >
          <option value="">Todas as pessoas</option>
          {people.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        <span id="dashboardFilterMethodLabel">Pagamento da casa</span>
        <select
          aria-labelledby="dashboardFilterMethodLabel"
          disabled={value.type === "personal"}
          value={value.method}
          onChange={(e) => update({ method: e.target.value })}
        >
          <option value="">Todos os métodos</option>
          <option>Dinheiro</option>
          <option>Vale</option>
        </select>
      </label>
    </div>
  );
  const count = [
    filters.category,
    filters.person,
    filters.method,
    filters.type !== "house",
    filters.query,
  ].filter(Boolean).length;
  if (!mobile)
    return (
      <section
        className="dashboard-filter-bar"
        aria-label="Filtros da dashboard"
      >
        {fields}
        <button type="button" className="filter-reset" onClick={reset}>
          Limpar filtros
        </button>
      </section>
    );
  return (
    <div className="dashboard-filter-bar">
      <span>
        {filters.type === "house"
          ? "Compartilhados"
          : filters.type === "personal"
            ? "Meu cofre"
            : "Casa + meu cofre"}
        {filters.category && " · " + filters.category}
      </span>
      <button
        className="filter-trigger"
        aria-haspopup="dialog"
        aria-controls="dashboardFiltersDialog"
        aria-label={
          count
            ? `Filtros · ${count} ${count === 1 ? "ativo" : "ativos"}`
            : "Filtros"
        }
        type="button"
        onClick={() => {
          setDraft(filters);
          window.AppUI.openModal("dashboardFiltersDialog");
        }}
      >
        {filters.type === "house"
          ? "Casa"
          : filters.type === "personal"
            ? "Pessoal"
            : "Casa + cofre"}{" "}
        · Filtros{count > 0 && <span>{count}</span>}
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          id="dashboardFiltersDialog"
          className="app-modal dashboard-filter-dialog"
          aria-labelledby="dashboardFiltersTitle"
          onKeyDown={containDialogFocus}
        >
          <header className="modal-heading">
            <h2 id="dashboardFiltersTitle">Filtrar período</h2>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => window.AppUI.closeModal("dashboardFiltersDialog")}
              aria-label="Fechar filtros"
            >
              Fechar
            </button>
          </header>
          {fields}
          <footer className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setDraft({
                  ...draft,
                  category: "",
                  person: "",
                  method: "",
                  type: "house",
                  query: "",
                })
              }
            >
              Limpar filtros
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                onChange(draft);
                window.AppUI.closeModal("dashboardFiltersDialog");
              }}
            >
              Aplicar filtros
            </button>
          </footer>
        </dialog>,
        document.body,
      )}
    </div>
  );
}
