export interface SettingsPorts {
  categories: readonly string[];
  getAccountName(): string;
  getPaymentMethods(): string[];
  api: {
    fetchSmartMetrics(
      days: number,
      options: { signal: AbortSignal },
    ): Promise<unknown>;
    fetchSmartRules(): Promise<unknown>;
    salvarRegraSmart(term: string, category: string): Promise<unknown>;
    excluirTermoSmart(term: string): Promise<unknown>;
    fetchAiSettings(): Promise<unknown>;
    saveAiSettings(payload: {
      action: string;
      provider: string;
      model: string;
      apiKey?: string;
    }): Promise<unknown>;
    fetchMembros(): Promise<unknown>;
    adicionarMembro(payload: {
      name: string;
      email: string;
      password: string;
    }): Promise<unknown>;
  };
  ui: {
    confirmAction(options: {
      title: string;
      message: string;
      confirmLabel: string;
    }): Promise<boolean>;
  };
  showToast(message: string, error?: boolean): void;
}
export interface Provider {
  id: string;
  name: string;
  keyUrl: string;
  models: {
    id: string;
    name: string;
    description: string;
    recommended: boolean;
  }[];
}
export interface SavedSettings {
  provider: string;
  model: string;
  hasKey: boolean;
}
export interface Member {
  nome: string;
  email: string;
  ativo: boolean;
}
export type Phase = "idle" | "loading" | "success" | "empty" | "error";
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Resposta incompleta. Tente novamente.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Resposta incompleta. Tente novamente.");
  return value;
}
export function parseSaved(value: unknown): SavedSettings | null {
  if (value === null) return null;
  const data = record(value);
  if (
    !["gemini", "deepseek"].includes(text(data.provider)) ||
    typeof data.hasKey !== "boolean"
  )
    throw new Error("Configuração inválida. Tente novamente.");
  return {
    provider: text(data.provider),
    model: text(data.model),
    hasKey: data.hasKey,
  };
}
export function parseConnection(value: unknown) {
  const data = record(value);
  if (
    !Array.isArray(data.providers) ||
    !data.providers.length ||
    typeof data.storageReady !== "boolean"
  )
    throw new Error("Configuração incompleta. Tente novamente.");
  const providers: Provider[] = data.providers.map((value) => {
    const provider = record(value),
      id = text(provider.id);
    if (
      !["gemini", "deepseek"].includes(id) ||
      !Array.isArray(provider.models) ||
      !provider.models.length
    )
      throw new Error("Provedor inválido. Tente novamente.");
    // Links come from a known provider, never from untrusted response content.
    return {
      id,
      name: text(provider.name),
      keyUrl:
        id === "gemini"
          ? "https://aistudio.google.com/api-keys"
          : "https://platform.deepseek.com/api_keys",
      models: provider.models.map((value) => {
        const model = record(value);
        return {
          id: text(model.id),
          name: text(model.name),
          description:
            typeof model.description === "string" ? model.description : "",
          recommended: model.recommended === true,
        };
      }),
    };
  });
  if (new Set(providers.map((p) => p.id)).size !== providers.length)
    throw new Error("Provedores duplicados. Tente novamente.");
  const saved = parseSaved(data.settings);
  if (saved && !providers.some((p) => p.id === saved.provider))
    throw new Error("Provedor salvo indisponível. Tente novamente.");
  return { providers, saved, storageReady: data.storageReady };
}
export function parseMembers(value: unknown): Member[] {
  if (!Array.isArray(value))
    throw new Error("Lista de usuários inválida. Tente novamente.");
  return value.map((value) => {
    const member = record(value);
    if (member.ativo !== undefined && typeof member.ativo !== "boolean")
      throw new Error("Usuário inválido. Tente novamente.");
    return {
      nome: typeof member.nome === "string" ? member.nome : "Usuário",
      email:
        typeof member.email === "string"
          ? member.email
          : "E-mail não informado",
      ativo: member.ativo !== false,
    };
  });
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
}

export interface LearnedRule {
  term: string;
  category: string;
  active: boolean;
  manual: boolean;
  confirmations: number;
}
export function parseRules(
  value: unknown,
  categories: readonly string[],
): LearnedRule[] {
  if (!Array.isArray(value))
    throw new Error("Aprendizado incompleto. Tente novamente.");
  return value.map((value) => {
    const rule = record(value),
      confirmations = Number(rule.confirmacoes ?? 0);
    if (
      !categories.includes(text(rule.categoria)) ||
      !Number.isSafeInteger(confirmations) ||
      confirmations < 0 ||
      (rule.ativo !== undefined && typeof rule.ativo !== "boolean") ||
      (rule.manual !== undefined && typeof rule.manual !== "boolean")
    )
      throw new Error("Regra inválida. Tente novamente.");
    return {
      term: text(rule.termo_normalizado).trim(),
      category: text(rule.categoria),
      active: rule.ativo !== false,
      manual: rule.manual === true,
      confirmations,
    };
  });
}
export function groupRules(rules: LearnedRule[]) {
  const groups = new Map<string, LearnedRule[]>();
  for (const rule of rules)
    groups.set(rule.term, [...(groups.get(rule.term) || []), rule]);
  return [...groups.entries()]
    .map(([term, rows]) => {
      const active = rows.filter((rule) => rule.active),
        manual = active.find((rule) => rule.manual);
      const principal =
        manual ||
        [...active].sort((a, b) => b.confirmations - a.confirmations)[0] ||
        rows[0]!;
      return {
        term,
        category: principal.category,
        manual: Boolean(manual),
        confirmations: rows.reduce((sum, rule) => sum + rule.confirmations, 0),
        competing: rows
          .filter((rule) => rule.category !== principal.category)
          .reduce((sum, rule) => sum + rule.confirmations, 0),
      };
    })
    .sort(
      (a, b) =>
        Number(b.manual) - Number(a.manual) ||
        b.confirmations - a.confirmations ||
        a.term.localeCompare(b.term),
    );
}
