import { useRef } from "react";
import type { SettingsPorts } from "./contracts";
import { useConnection } from "./useConnection";
export function AiConnection({ ports }: { ports: SettingsPorts }) {
  const ai = useConnection(ports),
    form = useRef<HTMLFormElement>(null);
  const provider = ai.providers.find((p) => p.id === ai.provider),
    saved = ai.saved?.hasKey && ai.saved.provider === ai.provider;
  const disabled =
    ai.busy ||
    ai.phase === "loading" ||
    ai.phase === "error" ||
    (ai.phase !== "idle" && !ai.ready);
  return (
    <>
      <article
        className="surface-card settings-group ai-settings-card"
        id="aiSettingsPanel"
        tabIndex={-1}
        aria-labelledby="aiSettingsTitle"
      >
        <div className="section-heading">
          <div>
            <h2 className="section-title" id="aiSettingsTitle">
              Assistente e integrações
            </h2>
            <p className="supporting-text">
              Conecte Gemini ou DeepSeek com sua própria chave.
            </p>
          </div>
          <span
            className={`ai-connection-badge${ai.saved?.hasKey ? " is-connected" : ""}`}
            id="aiConnectionBadge"
          >
            {ai.phase === "error"
              ? "Não verificada"
              : ai.phase === "loading"
                ? "Verificando…"
                : ai.saved?.hasKey
                  ? "Chave salva"
                  : "Não conectada"}
          </span>
        </div>
        {ai.phase === "loading" && (
          <p className="loading-inline" role="status">
            <span className="spinner" />
            Carregando configuração...
          </p>
        )}
        <form
          ref={form}
          autoComplete="off"
          className="form-stack"
          id="aiSettingsForm"
          aria-busy={ai.busy || ai.phase === "loading"}
          onSubmit={(event) => {
            event.preventDefault();
            void ai.act("save", event.currentTarget);
          }}
        >
          <p
            aria-live="polite"
            className="supporting-text"
            id="aiSettingsStatus"
            role={ai.phase === "error" ? "alert" : "status"}
          >
            {ai.status}
          </p>
          {ai.phase === "error" && (
            <button
              className="btn btn--tertiary"
              type="button"
              onClick={() => void ai.load()}
            >
              Tentar novamente
            </button>
          )}
          <div className="form-grid form-grid--2">
            <label className="field">
              <span>Provedor</span>
              <select
                id="aiProvider"
                required
                disabled={disabled}
                value={ai.provider}
                onChange={(e) => ai.selectProvider(e.target.value)}
              >
                {ai.providers.length ? (
                  ai.providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                ) : (
                  <option value="gemini">Aguardando configuração</option>
                )}
              </select>
            </label>
            <label className="field">
              <span>Modelo</span>
              <select
                id="aiModel"
                required
                disabled={disabled}
                value={ai.model}
                onChange={(e) => ai.setModel(e.target.value)}
              >
                {provider?.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.recommended ? " · recomendado" : ""}
                  </option>
                ))}
                <option value="custom">Outro modelo…</option>
              </select>
              <small id="aiModelHint">
                {ai.model === "custom"
                  ? "Confira se sua chave tem acesso a esse modelo."
                  : provider?.models.find((m) => m.id === ai.model)
                      ?.description || "Escolha uma opção sugerida."}
              </small>
            </label>
          </div>
          <label
            className="field"
            hidden={ai.model !== "custom"}
            id="aiCustomModelField"
          >
            <span>Identificador do modelo</span>
            <input
              id="aiCustomModel"
              maxLength={100}
              pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*"
              placeholder="Copie o nome do modelo no provedor"
              required={ai.model === "custom"}
              disabled={disabled}
              value={ai.custom}
              onChange={(e) => ai.setCustom(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Chave de API</span>
            <input
              autoComplete="new-password"
              id="aiApiKey"
              maxLength={512}
              placeholder={
                saved
                  ? "Chave salva · deixe vazio para manter"
                  : "Cole a chave deste provedor"
              }
              spellCheck={false}
              type="password"
              required={!saved}
              disabled={disabled}
              value={ai.key}
              onChange={(e) => ai.setKey(e.target.value)}
            />
            <small id="aiKeyHint">
              A chave é criptografada na sua conta e não volta ao navegador.
            </small>
          </label>
          {provider && (
            <a
              className="text-link"
              href={provider.keyUrl}
              id="aiKeyLink"
              rel="noopener noreferrer"
              target="_blank"
            >
              Obter uma chave no {provider.name} ↗
            </a>
          )}
          <details className="ai-data-help">
            <summary>Como seus dados são usados</summary>
            <p className="ai-usage-note">
              No chat, a IA recebe suas mensagens e um resumo dos gastos do
              contexto escolhido. As análises do cofre usam valores e sinais. O
              uso pode gerar cobrança no provedor.
            </p>
          </details>
          <div className="form-actions">
            <button
              className="btn btn--primary"
              id="aiSave"
              type="submit"
              disabled={disabled}
            >
              Salvar configuração
            </button>
            <button
              className="btn btn--tertiary"
              id="aiTest"
              type="button"
              disabled={disabled}
              onClick={() => void ai.act("test", form.current || undefined)}
            >
              Testar conexão
            </button>
            <button
              className="btn btn--ghost"
              hidden={!ai.saved?.hasKey}
              id="aiRemove"
              type="button"
              disabled={disabled}
              onClick={() => void ai.act("delete")}
            >
              Remover chave
            </button>
          </div>
        </form>
      </article>
    </>
  );
}
