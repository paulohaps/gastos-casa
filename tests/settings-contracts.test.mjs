import test from "node:test";
import assert from "node:assert/strict";
import {
  parseConnection,
  parseSaved,
  parseMembers,
  parseRules,
  groupRules,
} from "../src/features/settings/contracts.ts";
import { AI_PROVIDERS } from "../backend/services/ai-settings.mjs";
const categories = ["Mercado", "Contas", "Outros"];
test("configuração valida provedores e nunca repassa chave nem URL recebida", () => {
  const data = parseConnection({
    providers: AI_PROVIDERS.map((p) => ({
      ...p,
      keyUrl: "javascript:alert(1)",
    })),
    settings: {
      provider: "gemini",
      model: "gemini-2.5-flash",
      hasKey: true,
      apiKey: "must-not-return",
    },
    storageReady: true,
  });
  assert.equal(
    data.providers[0].keyUrl,
    "https://aistudio.google.com/api-keys",
  );
  assert.deepEqual(data.saved, {
    provider: "gemini",
    model: "gemini-2.5-flash",
    hasKey: true,
  });
  assert.throws(() =>
    parseConnection({ providers: {}, settings: null, storageReady: true }),
  );
  assert.throws(() =>
    parseConnection({
      providers: [...AI_PROVIDERS, AI_PROVIDERS[0]],
      settings: null,
      storageReady: true,
    }),
  );
  assert.throws(() =>
    parseSaved({ provider: "unknown", model: "model", hasKey: true }),
  );
});
test("usuários e regras rejeitam respostas incompletas antes da renderização", () => {
  assert.throws(() => parseMembers({ members: [] }));
  assert.throws(() => parseMembers([{ nome: "Ana", ativo: "true" }]));
  assert.throws(() =>
    parseRules(
      [{ termo_normalizado: "posto", categoria: "Ausente", confirmacoes: 1 }],
      categories,
    ),
  );
  assert.throws(() =>
    parseRules(
      [{ termo_normalizado: "posto", categoria: "Contas", confirmacoes: -1 }],
      categories,
    ),
  );
  assert.throws(() => parseRules([null], categories));
});
test("agrupamento mantém prioridade manual e evidências de categorias concorrentes", () => {
  const rows = parseRules(
    [
      {
        termo_normalizado: "posto",
        categoria: "Contas",
        confirmacoes: 1,
        manual: true,
        ativo: true,
      },
      {
        termo_normalizado: "posto",
        categoria: "Outros",
        confirmacoes: 8,
        manual: false,
        ativo: true,
      },
      {
        termo_normalizado: "mercado",
        categoria: "Mercado",
        confirmacoes: 20,
        manual: false,
        ativo: true,
      },
    ],
    categories,
  );
  const groups = groupRules(rows);
  assert.deepEqual(groups[0], {
    term: "posto",
    category: "Contas",
    manual: true,
    confirmations: 9,
    competing: 8,
  });
  assert.equal(groups[1].term, "mercado");
  assert.equal(rows[0].category, "Contas");
});
test("regra manual inativa não substitui a categoria aprendida ativa", () => {
  const rows = parseRules(
    [
      {
        termo_normalizado: "posto",
        categoria: "Contas",
        confirmacoes: 10,
        manual: true,
        ativo: false,
      },
      {
        termo_normalizado: "posto",
        categoria: "Outros",
        confirmacoes: 3,
        manual: false,
        ativo: true,
      },
    ],
    categories,
  );
  assert.equal(groupRules(rows)[0].category, "Outros");
  assert.equal(groupRules(rows)[0].manual, false);
});

test("métricas rejeitam contagens e taxas inválidas, preservando ausência de amostra", async () => {
  const { parseMetrics, percentage, duration } = await import(
    "../src/features/settings/metrics.ts"
  );
  const input = {
    days: 30,
    interpretations: 0,
    expenseInterpretations: 0,
    unsupported: 0,
    confirmed: 0,
    unconfirmed: 0,
    confirmationRate: null,
    noCorrection: 0,
    noCorrectionRate: null,
    avgConfirmSeconds: null,
    learningRecorded: 0,
    corrections: Object.fromEntries(
      ["value", "description", "category", "payment", "date"].map((field) => [
        field,
        { count: 0, rate: null },
      ]),
    ),
    learningImpact: {
      learnedConfirmed: 0,
      baselineConfirmed: 0,
      learnedCategoryCorrectionRate: null,
      baselineCategoryCorrectionRate: null,
      improvementPp: null,
    },
  };
  const value = parseMetrics(input);
  assert.equal(percentage(value.noCorrectionRate), "—");
  assert.equal(duration(value.seconds), "—");
  assert.throws(() => parseMetrics({ ...input, confirmed: -1 }));
  assert.throws(() => parseMetrics({ ...input, confirmationRate: 150 }));
});
