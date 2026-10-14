import { useState } from "react";
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
  const [expanded, setExpanded] = useState(
    () => !window.matchMedia("(max-width: 767px)").matches,
  );
  return (
    <details
      className="dashboard-filter-panel"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        Filtros do período{" "}
        <span>
          {filters.category ||
            (filters.type === "house"
              ? "Compartilhados"
              : filters.type === "personal"
                ? "Meu cofre"
                : "Casa + cofre")}
        </span>
      </summary>
      <section className="dashboard-filters" aria-label="Filtros da dashboard">
        <label>
          <span>Tipo de gasto</span>
          <select
            value={filters.type}
            onChange={(event) =>
              onChange({ type: event.target.value as FinancialFilters["type"] })
            }
          >
            <option value="house">Compartilhados</option>
            <option value="personal">Meu cofre</option>
            <option value="all">Casa + meu cofre</option>
          </select>
        </label>
        <label>
          <span>Categoria</span>
          <select
            value={filters.category}
            onChange={(event) => onChange({ category: event.target.value })}
          >
            <option value="">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Pagador da casa</span>
          <select
            disabled={filters.type === "personal"}
            value={filters.person}
            onChange={(event) => onChange({ person: event.target.value })}
          >
            <option value="">Todas as pessoas</option>
            {people.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Pagamento da casa</span>
          <select
            disabled={filters.type === "personal"}
            value={filters.method}
            onChange={(event) => onChange({ method: event.target.value })}
          >
            <option value="">Todos os métodos</option>
            <option>Dinheiro</option>
            <option>Vale</option>
          </select>
        </label>
        <button type="button" className="btn btn--secondary" onClick={reset}>
          Limpar filtros
        </button>
      </section>
    </details>
  );
}
