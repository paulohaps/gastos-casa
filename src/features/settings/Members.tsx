import { useCallback, useEffect, useRef, useState } from "react";
import {
  errorMessage,
  parseMembers,
  type Member,
  type Phase,
  type SettingsPorts,
} from "./contracts";
export function Members({ ports }: { ports: SettingsPorts }) {
  const [items, setItems] = useState<Member[]>([]),
    [phase, setPhase] = useState<Phase>("idle"),
    [error, setError] = useState("");
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null),
    name = useRef<HTMLInputElement>(null);
  const version = useRef(0),
    loading = useRef(false),
    acting = useRef(false);
  const load = useCallback(async () => {
    if (loading.current) return;
    const turn = version.current;
    loading.current = true;
    setPhase("loading");
    setItems([]);
    setError("");
    try {
      const members = parseMembers(await ports.api.fetchMembros());
      if (turn !== version.current) return;
      setItems(members);
      setPhase(members.length ? "success" : "empty");
    } catch (error) {
      if (turn === version.current) {
        setError(errorMessage(error));
        setPhase("error");
      }
    } finally {
      if (turn === version.current) loading.current = false;
    }
  }, [ports]);
  useEffect(() => {
    const clear = () => {
      version.current++;
      loading.current = false;
      acting.current = false;
      setItems([]);
      setPhase("idle");
      setOpen(false);
      setBusy(false);
      setError("");
      form.current?.reset();
    };
    const leave = (event: Event) => {
      if ((event as CustomEvent<{ view: string }>).detail.view !== "ajustes") {
        setOpen(false);
        form.current?.reset();
      }
    };
    const toggle = (event: Event) => {
      if (acting.current) return;
      const forced = (event as CustomEvent<{ open?: boolean }>).detail?.open;
      setOpen((current) => forced ?? !current);
      form.current?.reset();
    };
    window.addEventListener("gastos:membersload", load);
    window.addEventListener("gastos:authenticated", load);
    window.addEventListener("gastos:sessioncleared", clear);
    window.addEventListener("gastos:viewchange", leave);
    window.addEventListener("gastos:memberstoggle", toggle);
    void load();
    return () => {
      version.current++;
      window.removeEventListener("gastos:membersload", load);
      window.removeEventListener("gastos:authenticated", load);
      window.removeEventListener("gastos:sessioncleared", clear);
      window.removeEventListener("gastos:viewchange", leave);
      window.removeEventListener("gastos:memberstoggle", toggle);
    };
  }, [load]);
  useEffect(() => {
    if (open) name.current?.focus({ preventScroll: true });
  }, [open]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (acting.current) return;
    const target = event.currentTarget,
      data = new FormData(target),
      turn = version.current;
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      password: String(data.get("password") || ""),
    };
    acting.current = true;
    setBusy(true);
    setError("");
    try {
      await ports.api.adicionarMembro(payload);
      if (turn !== version.current) return;
      target.reset();
      setOpen(false);
      await load();
      if (turn === version.current)
        ports.showToast("Usuário cadastrado e autorizado!");
    } catch (error) {
      if (turn === version.current) setError(errorMessage(error));
    } finally {
      if (turn === version.current) {
        acting.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <article
      className="surface-card settings-group"
      aria-labelledby="membersTitle"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Configurações</p>
          <h2 className="section-title" id="membersTitle">
            Usuários da casa
          </h2>
          <p className="supporting-text">
            Gerencie quem pode acessar as despesas compartilhadas.
          </p>
        </div>
        <button
          className="btn btn--tertiary btn--compact"
          type="button"
          disabled={busy}
          aria-expanded={open}
          aria-controls="formMembro"
          onClick={() => {
            form.current?.reset();
            setOpen(!open);
          }}
        >
          Novo usuário
        </button>
      </div>
      <form
        ref={form}
        className={`form-stack member-form${open ? "" : " hidden"}`}
        id="formMembro"
        onSubmit={submit}
      >
        <div className="form-grid form-grid--3">
          <label className="field">
            <span>Nome</span>
            <input
              ref={name}
              id="membroNome"
              name="name"
              minLength={2}
              maxLength={120}
              placeholder="Nome completo"
              required
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input
              id="membroEmail"
              name="email"
              type="email"
              maxLength={254}
              placeholder="email@exemplo.com"
              required
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Senha inicial</span>
            <input
              id="membroSenha"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              placeholder="Mínimo 8 caracteres"
              required
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            className="btn btn--ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              form.current?.reset();
              setOpen(false);
            }}
          >
            Cancelar
          </button>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? "Cadastrando..." : "Cadastrar usuário"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="module-error">
          {error}
          {phase === "error" && (
            <button type="button" onClick={() => void load()}>
              Tentar novamente
            </button>
          )}
        </p>
      )}
      <div
        className="member-list"
        id="listaMembros"
        aria-busy={phase === "loading"}
      >
        {phase === "loading" && (
          <p role="status" className="loading-inline">
            <span className="spinner" />
            Carregando usuários...
          </p>
        )}
        {phase === "empty" && (
          <p className="recurring-empty">
            Nenhum usuário autorizado encontrado.
          </p>
        )}
        {items.map((member, index) => (
          <div className="member-item" key={`${member.email}-${index}`}>
            <span className="member-avatar" aria-hidden="true">
              {member.nome.charAt(0).toUpperCase()}
            </span>
            <div className="member-item__content">
              <strong>{member.nome}</strong>
              <span>{member.email}</span>
            </div>
            <span
              className={`status-badge status-badge--${member.ativo ? "success" : "warning"}`}
            >
              {member.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
