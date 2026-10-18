import test from "node:test";
import assert from "node:assert/strict";
import { expenseIntelligence } from "../js/core/expense-intelligence.mjs";
import { settlementAvailability } from "../js/core/settlement-summary.mjs";
import { createAssistantService } from "../backend/services/assistant.mjs";
const options = {
  context: { scope: "house", month: "2026-09" },
  today: "2026-09-22",
};
const row = (data, valor, descricao = "Mercado", categoria = "Mercado") => ({
  data,
  valor,
  descricao,
  categoria,
});
test("capacidade, integridade e falha de transporte são estados diferentes", () => {
  assert.equal(settlementAvailability(null), "unavailable");
  assert.equal(settlementAvailability([]), "upgrade");
  assert.equal(
    settlementAvailability(Object.assign([], { atomic: true })),
    "incomplete",
  );
  assert.equal(
    settlementAvailability(Object.assign([], { atomic: true, complete: true })),
    "ready",
  );
});
test("concentração usa centavos exatos, explicita amostra e rejeita fração de centavo", () => {
  const result = expenseIntelligence({
    ...options,
    current: [row("2026-09-01", 0.1), row("2026-09-02", 0.2)],
  });
  assert.equal(result.totalCents, 30);
  assert.equal(result.concentration.percent, 100);
  assert.equal(result.evidence, "insufficient");
  assert.throws(() =>
    expenseIntelligence({ ...options, current: [row("2026-09-01", 0.005)] }),
  );
});
test("mediana exclui a própria observação, exige cinco pares e não chama anomalia de fraude", () => {
  const items = Array.from({ length: 5 }, (_, i) =>
    row(`2026-09-0${i + 1}`, 10),
  );
  const result = expenseIntelligence({
    ...options,
    current: [...items, row("2026-09-10", 60, "Compra maior")],
  });
  assert.equal(result.unusualExpenses.length, 1);
  assert.equal(result.unusualExpenses[0].medianReferenceCents, 1000);
  assert.equal(result.unusualExpenses[0].referenceCount, 5);
  assert.match(result.unusualExpenses[0].rule, /não prova erro ou fraude/);
  assert.equal(
    expenseIntelligence({
      ...options,
      current: [...items.slice(1), row("2026-09-10", 60)],
    }).unusualExpenses.length,
    0,
  );
});
test("recorrência é candidata em três meses consecutivos e não é criada com base incompleta", () => {
  const sample = {
    context: { scope: "wallet", month: "2026-09", startMonth: "2026-07" },
    today: "2026-09-22",
    current: ["07", "08", "09"].map((m) =>
      row(`2026-${m}-10`, 39.9, "Assinatura", "Serviços"),
    ),
  };
  const result = expenseIntelligence(sample);
  assert.equal(result.recurringCandidates.length, 1);
  assert.equal(result.recurringCandidates[0].referenceCents, 3990);
  assert.equal(result.recurringCandidates[0].evidence, "candidate");
  assert.equal(
    expenseIntelligence({ ...sample, current: sample.current.slice(1) })
      .recurringCandidates.length,
    0,
  );
  assert.equal(
    expenseIntelligence({
      ...options,
      context: { scope: "house", month: "2026-09", startMonth: "2026-08" },
      current: [
        row("2026-08-10", 40, "Assinatura"),
        row("2026-09-10", 40, "Assinatura"),
      ],
      previous: [row("2026-07-10", 40, "Assinatura")],
      baselineComplete: false,
    }).recurringCandidates.length,
    0,
  );
});
test("dias futuros, meses ausentes, escopos e valores instáveis não fabricam um hábito", () => {
  const context = { scope: "house", month: "2026-09", startMonth: "2026-06" };
  const current = ["06", "08", "09"].map((m) =>
    row(`2026-${m}-10`, 40, "Assinatura"),
  );
  assert.equal(
    expenseIntelligence({ ...options, context, current }).recurringCandidates
      .length,
    0,
  );
  assert.equal(
    expenseIntelligence({ ...options, current: [row("2026-09-30", 100)] })
      .recordCount,
    0,
  );
  const mixed = ["07", "08", "09"].map((m, i) => ({
    ...row(`2026-${m}-10`, 40, "Assinatura"),
    scope: i ? "house" : "personal",
  }));
  assert.equal(
    expenseIntelligence({ ...options, context, current: mixed })
      .recurringCandidates.length,
    0,
  );
  mixed[0].scope = "house";
  mixed[0].valor = 80;
  assert.equal(
    expenseIntelligence({ ...options, context, current: mixed })
      .recurringCandidates.length,
    0,
  );
});
test("datas impossíveis, fora de período e overflow monetário são recusados", () => {
  for (const date of ["2026-13-01", "2026-09-31", "2026-08-01"])
    assert.throws(
      () => expenseIntelligence({ ...options, current: [row(date, 10)] }),
      /DATA_UNAVAILABLE/,
    );
  assert.throws(() =>
    expenseIntelligence({
      ...options,
      current: [row("2026-09-01", Number.MAX_SAFE_INTEGER)],
    }),
  );
});
test("dez mil registros continuam descritivos sem gerar lista ilimitada", () => {
  const current = Array.from({ length: 10000 }, (_, i) =>
    row(
      `2026-09-${String((i % 20) + 1).padStart(2, "0")}`,
      i % 100 === 0 ? 100 : 10,
      "Compra " + i,
    ),
  );
  const result = expenseIntelligence({ ...options, current });
  assert.equal(result.recordCount, 10000);
  assert.equal(result.unusualExpenses.length, 5);
});
test("assistente recebe heurísticas reais do cofre autorizado e não consulta Casa", async () => {
  const owner = "11111111-1111-4111-8111-111111111111",
    walletId = "22222222-2222-4222-8222-222222222222";
  const queries = [];
  let instruction = "";
  const service = createAssistantService({
    now: () => Date.parse("2026-09-22T12:00:00Z"),
    resolveConfig: async () => ({
      provider: "deepseek",
      model: "deepseek-chat",
      apiKey: "test",
    }),
    dataApi: async (path) => {
      queries.push(path);
      if (/offset=(?!0(?:&|$))/.test(path)) return Response.json([]);
      if (path.startsWith("/personal_wallets"))
        return Response.json([
          { id: walletId, nome: "Privado", limite_mensal: 1000 },
        ]);
      return Response.json(
        path.includes("gte.2026-09") ? [row("2026-09-12", 10)] : [],
      );
    },
    generate: async (_, text) => {
      instruction = text;
    },
  });
  const prepared = await service.prepare(owner, "token", {
    context: { scope: "wallet", walletId, month: "2026-09" },
    messages: [{ role: "user", content: "Que padrões aparecem?" }],
  });
  try {
    await prepared.stream({});
  } finally {
    prepared.release();
  }
  assert.match(instruction, /"expenseIntelligence":/);
  assert.match(
    instruction,
    /"concentration":\{"category":"Mercado","totalCents":1000/,
  );
  assert.match(instruction, /não prova fraude/);
  assert.ok(
    !queries.some(
      (path) =>
        path.startsWith("/gastos") ||
        path.startsWith("/acertos") ||
        path.startsWith("/household_members"),
    ),
  );
});
