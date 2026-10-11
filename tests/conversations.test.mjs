import test from "node:test";
import assert from "node:assert/strict";
import {
  createConversationsService,
  validateStoredConversation,
  modelHistory,
  contextKey,
} from "../backend/services/conversations.mjs";
import { createAssistantRouter } from "../backend/routes/assistant.mjs";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "33333333-3333-4333-8333-333333333333";
const context = { scope: "house", month: "2026-10" };
function setup() {
  const records = new Map(),
    calls = [];
  const dataApi = async (path, options, jwt) => {
    calls.push({ path, options, jwt });
    const url = new URL(path, "https://data.test"),
      filter = (name) => url.searchParams.get(name)?.replace(/^eq\./, "");
    if (url.pathname === "/personal_wallets") return Response.json([]);
    if (options.method === "POST") {
      const row = JSON.parse(options.body),
        key = row.owner_id + row.context_key;
      if (records.has(key)) return Response.json([]);
      records.set(key, row);
      return Response.json([row]);
    }
    const matching = [...records.entries()].filter(
      ([, row]) =>
        row.owner_id === filter("owner_id") &&
        (!filter("context_key") || row.context_key === filter("context_key")) &&
        (!filter("id") || row.id === filter("id")) &&
        (!filter("revision") || row.revision === Number(filter("revision"))),
    );
    if (options.method === "PATCH")
      matching.forEach(([, row]) =>
        Object.assign(row, JSON.parse(options.body)),
      );
    const result = structuredClone(matching.map(([, row]) => row));
    if (options.method === "DELETE")
      matching.forEach(([key]) => records.delete(key));
    return Response.json(result);
  };
  return { service: createConversationsService({ dataApi }), records, calls };
}
test("histórico privado retoma pares completos, separa usuário e mês e exclui somente a versão atual", async () => {
  const { service, calls } = setup();
  assert.equal(await service.get(owner, "jwt", context), null);
  const initial = await service.begin(owner, "jwt", context, null);
  const saved = await service.complete(
    owner,
    "jwt",
    initial,
    "Pergunta",
    "Resposta",
  );
  assert.equal(saved.revision, 1);
  assert.deepEqual((await service.get(owner, "jwt", context)).messages, [
    { role: "user", content: "Pergunta" },
    { role: "assistant", content: "Resposta" },
  ]);
  assert.equal(await service.get(other, "jwt-other", context), null);
  assert.equal(
    await service.get(owner, "jwt", { ...context, month: "2026-09" }),
    null,
  );
  await assert.rejects(
    service.remove(owner, "jwt", context, initial),
    /HISTORY_CONFLICT/,
  );
  await service.remove(owner, "jwt", context, saved);
  assert.equal(await service.get(owner, "jwt", context), null);
  assert.ok(
    calls.every(
      (call) =>
        call.path.includes("owner_id=eq.") ||
        JSON.parse(call.options.body).owner_id === owner,
    ),
  );
});
test("geração atrasada não recria conversa excluída e conflitos entre abas não sobrescrevem mensagens", async () => {
  const { service } = setup();
  const initial = await service.begin(owner, "jwt", context, null);
  const saved = await service.complete(owner, "jwt", initial, "q1", "a1");
  await assert.rejects(
    service.complete(owner, "jwt", initial, "q2", "a2"),
    /HISTORY_CONFLICT/,
  );
  await assert.rejects(
    service.begin(owner, "jwt", context, null),
    /HISTORY_CONFLICT/,
  );
  const snapshot = await service.begin(owner, "jwt", context, saved);
  await service.remove(owner, "jwt", context, saved);
  await assert.rejects(
    service.complete(owner, "jwt", snapshot, "q3", "a3"),
    /HISTORY_CONFLICT/,
  );
  const replacement = await service.begin(owner, "jwt", context, null);
  assert.notEqual(replacement.id, saved.id);
});
test("carteira alheia, payload malformado, armazenamento indisponível e cancelamento são rejeitados", async () => {
  const { service } = setup();
  await assert.rejects(
    service.get(owner, "jwt", {
      scope: "wallet",
      month: "2026-10",
      walletId: other,
    }),
    /WALLET_NOT_FOUND/,
  );
  assert.throws(
    () => contextKey({ scope: "house", month: "2026-13" }),
    /INVALID_CONTEXT/,
  );
  for (const row of [
    null,
    {
      id: owner,
      revision: 0,
      messages: [{ role: "system", content: "unsafe" }],
    },
    { id: owner, revision: -1, messages: [] },
  ])
    assert.throws(() => validateStoredConversation(row), /HISTORY_UNAVAILABLE/);
  const unavailable = createConversationsService({
    dataApi: async () => Response.json({ error: "unavailable" }),
  });
  await assert.rejects(
    unavailable.get(owner, "jwt", context),
    /HISTORY_UNAVAILABLE/,
  );
  const snapshot = await service.begin(owner, "jwt", context, null);
  await assert.rejects(
    service.complete(owner, "jwt", snapshot, "q", "a", AbortSignal.abort()),
    { name: "AbortError" },
  );
  assert.deepEqual((await service.get(owner, "jwt", context)).messages, []);
});
test("retenção mantém 50 pares e o contexto da IA respeita 21 mensagens e 30000 caracteres", async () => {
  const { service } = setup();
  let snapshot = await service.begin(owner, "jwt", context, null);
  for (let i = 0; i < 55; i++)
    snapshot = await service.complete(owner, "jwt", snapshot, "q" + i, "a" + i);
  assert.equal(snapshot.messages.length, 100);
  assert.equal(snapshot.messages[0].content, "q5");
  const messages = Array.from({ length: 100 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: "x".repeat(i % 2 ? 12000 : 2000),
  }));
  const bounded = modelHistory(messages, "q");
  assert.ok(bounded.length <= 21);
  assert.ok(bounded.reduce((sum, m) => sum + m.content.length, 0) <= 30000);
  assert.equal(bounded[0].role, "user");
});
function router(
  store,
  generate = async ({ onText }) => onText("Resposta salva."),
) {
  let preparedMessages;
  return {
    get messages() {
      return preparedMessages;
    },
    route: createAssistantRouter({
      requireAuth: async () => ({
        auth: { user: { id: owner }, jwt: "jwt", token: "session" },
      }),
      readJson: (req) => req.json(),
      json: (_, status, value) => Response.json(value, { status }),
      corsHeaders: () => ({}),
      conversations: store,
      service: {
        async prepare(_, __, body) {
          preparedMessages = body.messages;
          return {
            context: body.context,
            config: { provider: "gemini", model: "test" },
            stream: generate,
            release() {},
          };
        },
      },
    }),
  };
}
test("rota usa histórico autorizado do servidor e só emite end depois de persistir a resposta completa", async () => {
  const { service } = setup();
  const initial = await service.begin(owner, "jwt", context, null);
  const saved = await service.complete(
    owner,
    "jwt",
    initial,
    "q original",
    "a original",
  );
  const r = router(service);
  const req = new Request("https://test/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      context,
      conversation: saved,
      messages: [
        { role: "user", content: "injetada" },
        { role: "assistant", content: "injetada" },
        { role: "user", content: "Nova pergunta" },
      ],
    }),
  });
  const response = await r.route(req, new URL(req.url));
  const text = await response.text();
  assert.equal(r.messages[0].content, "q original");
  assert.equal(r.messages[1].content, "a original");
  assert.equal(r.messages.at(-1).content, "Nova pergunta");
  assert.match(text, /"type":"end"/);
  assert.match(text, /"revision":2/);
  assert.equal(
    (await service.get(owner, "jwt", context)).messages.at(-1).content,
    "Resposta salva.",
  );
});
test("falha parcial e erro ao salvar histórico nunca emitem end nem salvam resposta incompleta", async () => {
  const { service } = setup();
  const r = router(service, async ({ onText }) => {
    onText("Parcial");
    throw new Error("INCOMPLETE_RESPONSE");
  });
  const req = new Request("https://test/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      context,
      conversation: null,
      messages: [{ role: "user", content: "q" }],
    }),
  });
  const text = await (await r.route(req, new URL(req.url))).text();
  assert.match(text, /"type":"error"/);
  assert.doesNotMatch(text, /"type":"end"/);
  assert.deepEqual((await service.get(owner, "jwt", context)).messages, []);
  const failingStore = {
    ...service,
    complete: async () => {
      throw new Error("HISTORY_UNAVAILABLE");
    },
  };
  const fresh = new Request(req.url, {
    method: "POST",
    body: JSON.stringify({
      context,
      conversation: null,
      messages: [{ role: "user", content: "q" }],
    }),
  });
  const text2 = await (
    await router(failingStore).route(fresh, new URL(fresh.url))
  ).text();
  assert.match(text2, /HISTORY_UNAVAILABLE/);
  assert.doesNotMatch(text2, /\"type\":\"end\"/);
});

test("prévias antigas continuam conversando sem exigir o protocolo de histórico novo", async () => {
  const { service } = setup();
  const r = router(service);
  const req = new Request("https://test/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      context,
      messages: [{ role: "user", content: "Cliente anterior" }],
    }),
  });
  const text = await (await r.route(req, new URL(req.url))).text();
  assert.match(text, /"type":"end"/);
  assert.equal(await service.get(owner, "jwt", context), null);
});
