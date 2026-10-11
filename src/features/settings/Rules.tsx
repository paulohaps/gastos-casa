import { useCallback, useEffect, useRef, useState } from "react";
import {
  errorMessage,
  groupRules,
  parseRules,
  type LearnedRule,
  type Phase,
  type SettingsPorts,
} from "./contracts";
import { Icon } from "../../shared/ui/Icon";
export function Rules({ ports }: { ports: SettingsPorts }) {
  const [rules, setRules] = useState<LearnedRule[]>([]),
    [phase, setPhase] = useState<Phase>("idle"),
    [error, setError] = useState("");
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [term, setTerm] = useState(""),
    [category, setCategory] = useState("Outros");
  const generation = useRef(0),
    loading = useRef(false),
    acting = useRef(false),
    loaded = useRef(false),
    input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    if (loading.current) return;
    const turn = generation.current;
    loading.current = true;
    setPhase("loading");
    setRules([]);
    setError("");
    try {
      const rows = parseRules(
        await ports.api.fetchSmartRules(),
        ports.categories,
      );
      if (turn !== generation.current) return;
      setRules(rows);
      setPhase(rows.length ? "success" : "empty");
      loaded.current = true;
    } catch (error) {
      if (turn === generation.current) {
        setPhase("error");
        setError(errorMessage(error));
      }
    } finally {
      if (turn === generation.current) loading.current = false;
    }
  }, [ports]);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      loading.current = false;
      acting.current = false;
      loaded.current = false;
      setRules([]);
      setPhase("idle");
      setError("");
      setBusy(false);
      setOpen(false);
      setTerm("");
      setCategory("Outros");
    };
    const toggle = (event: Event) => {
      if (acting.current) return;
      const data = (
        event as CustomEvent<{
          open?: boolean;
          term?: string;
          category?: string;
        }>
      ).detail;
      setOpen((current) => data.open ?? !current);
      setTerm(data.term || "");
      setCategory(
        ports.categories.includes(data.category || "")
          ? data.category!
          : "Outros",
      );
    };
    const view = (event: Event) => {
      if ((event as CustomEvent<{ view: string }>).detail.view === "ajustes") {
        if (!loaded.current) void load();
      } else {
        setOpen(false);
        setTerm("");
      }
    };
    window.addEventListener("gastos:rulesload", load);
    window.addEventListener("gastos:rulestoggle", toggle);
    window.addEventListener("gastos:viewchange", view);
    window.addEventListener("gastos:sessioncleared", clear);
    window.addEventListener("gastos:authenticated", load);
    if (window.GastosNavigation.current() === "ajustes") void load();
    return () => {
      generation.current++;
      window.removeEventListener("gastos:rulesload", load);
      window.removeEventListener("gastos:rulestoggle", toggle);
      window.removeEventListener("gastos:viewchange", view);
      window.removeEventListener("gastos:sessioncleared", clear);
      window.removeEventListener("gastos:authenticated", load);
    };
  }, [load, ports]);
  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);
  async function write(term: string, category?: string) {
    if (acting.current) return;
    const turn = generation.current;
    acting.current = true;
    setBusy(true);
    setError("");
    try {
      if (category === undefined) {
        const confirmed = await ports.ui.confirmAction({
          title: "Excluir aprendizado",
          message: `Todas as evidências e regras para "${term}" serão removidas. Deseja continuar?`,
          confirmLabel: "Excluir",
        });
        if (!confirmed || turn !== generation.current) return;
        await ports.api.excluirTermoSmart(term);
      } else await ports.api.salvarRegraSmart(term, category);
      if (turn !== generation.current) return;
      setOpen(false);
      setTerm("");
      await load();
      if (turn === generation.current)
        ports.showToast(
          category === undefined
            ? "Aprendizado removido."
            : "Regra inteligente fixada.",
        );
    } catch (error) {
      if (turn === generation.current) setError(errorMessage(error));
    } finally {
      if (turn === generation.current) {
        acting.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section
      aria-labelledby="smartRulesTitle"
      className="surface-card settings-group smart-rules-settings"
    >
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">Aprendizado</p>
          <h3 className="section-title" id="smartRulesTitle">
            Regras aprendidas
          </h3>
          <p className="supporting-text">
            O sistema aprende com gastos confirmados. Você pode fixar uma
            categoria para os próximos lançamentos.
          </p>
        </div>
        <button
          className="btn btn--tertiary btn--compact"
          type="button"
          disabled={busy}
          aria-expanded={open}
          aria-controls="formSmartRule"
          onClick={() => {
            setTerm("");
            setCategory("Outros");
            setOpen(!open);
          }}
        >
          Nova regra
        </button>
      </div>
      <form
        className={`form-stack smart-rule-form${open ? "" : " hidden"}`}
        id="formSmartRule"
        onSubmit={(event) => {
          event.preventDefault();
          void write(term.trim(), category);
        }}
      >
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Termo ou estabelecimento</span>
            <input
              ref={input}
              id="smartRuleTermo"
              maxLength={120}
              minLength={2}
              placeholder="Ex.: Posto Trevo"
              required
              disabled={busy}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Categoria</span>
            <select
              id="smartRuleCategoria"
              disabled={busy}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {ports.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "Ifood" ? "iFood" : cat}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button
            className="btn btn--ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              setTerm("");
              setOpen(false);
            }}
          >
            Cancelar
          </button>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Salvar regra"}
          </button>
        </div>
      </form>
      {error && (
        <p className="module-error" role="alert">
          {error}
          {phase === "error" && (
            <button type="button" onClick={() => void load()}>
              Tentar novamente
            </button>
          )}
        </p>
      )}
      <div
        className="smart-rule-list"
        id="listaSmartRules"
        aria-busy={phase === "loading"}
      >
        {(phase === "loading" || phase === "idle") && (
          <p className="loading-inline" role="status">
            <span className="spinner" />
            Carregando aprendizado...
          </p>
        )}
        {phase === "empty" && (
          <p className="recurring-empty">
            Nenhuma regra aprendida ainda. Confirme gastos pelo lançamento
            rápido ou crie uma regra manual.
          </p>
        )}
        {groupRules(rules).map((group) => (
          <RuleRow
            key={`${group.term}-${group.category}`}
            group={group}
            categories={ports.categories}
            busy={busy}
            write={write}
          />
        ))}
      </div>
    </section>
  );
}
function RuleRow({
  group,
  categories,
  busy,
  write,
}: {
  group: ReturnType<typeof groupRules>[number];
  categories: readonly string[];
  busy: boolean;
  write(term: string, category?: string): Promise<void>;
}) {
  const [category, setCategory] = useState(group.category);
  return (
    <article className="smart-rule-item">
      <div className="smart-rule-item__info">
        <div className="smart-rule-item__title">
          <strong>{group.term}</strong>
          <span
            className={`status-badge status-badge--${!group.manual && group.competing ? "warning" : "success"}`}
          >
            {group.manual
              ? "Manual"
              : group.competing
                ? "Revisar"
                : "Aprendido"}
          </span>
        </div>
        <span>
          {group.manual
            ? "Regra explícita • prioridade máxima"
            : `${group.confirmations} ${group.confirmations === 1 ? "confirmação" : "confirmações"}${group.competing ? ` • ${group.competing} em categoria concorrente` : ""}`}
        </span>
      </div>
      <div className="smart-rule-item__controls">
        <select
          aria-label={`Categoria para ${group.term}`}
          disabled={busy}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "Ifood" ? "iFood" : cat}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="table-action"
          aria-label={`Fixar categoria para ${group.term}`}
          disabled={busy}
          onClick={() => void write(group.term, category)}
        >
          <Icon name="check" />
        </button>
        <button
          type="button"
          className="table-action table-action--danger"
          aria-label={`Excluir aprendizado de ${group.term}`}
          disabled={busy}
          onClick={() => void write(group.term)}
        >
          <Icon name="trash" />
        </button>
      </div>
    </article>
  );
}
