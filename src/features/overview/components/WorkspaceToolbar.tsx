import type { FinancialFilters } from "../filters";

export function WorkspaceToolbar({
  filters,
  onChange,
}: {
  filters: FinancialFilters;
  onChange(next: Partial<FinancialFilters>): void;
}) {
  return (
    <div className="workspace-toolbar">
      <div
        className="workspace-switch"
        role="group"
        aria-label="Espaço financeiro"
      >
        <button
          type="button"
          aria-pressed={filters.type === "house"}
          onClick={() =>
            onChange({
              type: "house",
              category: "",
              person: "",
              method: "",
              query: "",
            })
          }
        >
          Casa
        </button>
        <button
          type="button"
          aria-pressed={filters.type === "personal"}
          onClick={() =>
            onChange({
              type: "personal",
              category: "",
              person: "",
              method: "",
              query: "",
            })
          }
        >
          Pessoal
        </button>
      </div>
      <nav className="workspace-shortcuts" aria-label="Atalhos do espaço">
        {filters.type === "personal" ? (
          <a href="#carteiras">Abrir meu cofre →</a>
        ) : (
          <>
            <a
              href="#casa"
              onClick={(event) => {
                event.preventDefault();
                window.GastosNavigation.showHouse("despesas");
              }}
            >
              Movimentações
            </a>
            <a
              href="#casa"
              onClick={(event) => {
                event.preventDefault();
                window.GastosNavigation.showHouse("acertos");
              }}
            >
              Acertos
            </a>
            <a
              href="#casa"
              onClick={(event) => {
                event.preventDefault();
                window.GastosNavigation.showHouse("planejamento");
              }}
            >
              Planejamento
            </a>
          </>
        )}
      </nav>
    </div>
  );
}
