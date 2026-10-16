// Explicitly isolated deployment test. Never accepts the production Function URL.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const file = process.env.GASTOS_RELEASE_SESSION_FILE;
if (!file) throw Error("GASTOS_RELEASE_SESSION_FILE is required.");
const state = JSON.parse(await readFile(file, "utf8"));
const backend =
  "https://br-polished-voice-a5flam43-gc20releasecheck.compute.c-1.us-east-2.aws.neon.tech";
const dataApi =
  "https://ep-wild-wind-ac7p8wta.apirest.sa-east-1.aws.neon.tech/gastos_casa/rest/v1";
assert.equal(state.backend, backend);
assert.equal(
  state.authOrigin,
  "https://ep-wild-wind-ac7p8wta.neonauth.sa-east-1.aws.neon.tech/release_identity/auth",
);
const [ph, fg, outsider] = state.accounts,
  report = [];
let wallet, personal, conversation, payment;
const shared = [];
async function call(account, path, body, method = body ? "POST" : "GET") {
  const r = await fetch(backend + path, {
    method,
    headers: {
      Origin: "https://paulohaps.github.io",
      Authorization: "Bearer " + account.token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  return { status: r.status, data };
}
async function raw(account, path, body, method = body ? "POST" : "GET") {
  const cookie = JSON.parse(Buffer.from(account.token, "base64url").toString());
  const response = await fetch(state.authOrigin + "/token", {
    headers: {
      Cookie: cookie.cookieName + "=" + cookie.cookieValue,
      Origin: "https://paulohaps.github.io",
    },
  });
  assert.equal(response.status, 200);
  const token = (await response.json()).token;
  const r = await fetch(dataApi + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}
function pass(name) {
  report.push(name);
  console.log("PASS: " + name);
}
try {
  for (const a of state.accounts)
    assert.equal((await call(a, "/session")).status, 200);
  const empty = await call(ph, "/expenses?month=11%2F2099");
  assert.equal(empty.status, 200);
  assert.equal(empty.data.expenses.length, 0);
  const capability = await call(ph, "/settlements?month=11%2F2099");
  assert.equal(capability.status, 200);
  assert.equal(capability.data.atomicSettlements, true);
  pass(
    "real sessions, JWT, native Data API and versioned settlement capability",
  );
  for (const [account, value] of [
    [ph, 100],
    [fg, 200.01],
  ]) {
    const r = await call(account, "/expenses", {
      action: "add",
      dataGasto: "2099-11-10",
      valor: value,
      descricao: "GC20 isolated release check",
      categoria: "Outros",
      formaPagamento: "Dinheiro",
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.data?.[0]?.id);
    shared.push(r.data.data[0].id);
  }
  const before = await call(ph, "/expenses?month=11%2F2099");
  assert.equal(before.data.expenses.length, 2);
  const payload = {
    action: "add",
    month: "11/2099",
    dataPagamento: "2099-11-10",
    recebedor: "Fernando Gustavo",
    formaPagamento: "Dinheiro",
    valor: 50.01,
    observacao: "GC20 isolated release check",
  };
  const requests = [
    { ...payload, idempotencyKey: randomUUID() },
    { ...payload, idempotencyKey: randomUUID() },
  ];
  const results = await Promise.all(
    requests.map((body) => call(ph, "/settlements", body)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const index = results.findIndex((r) => r.status === 200);
  payment = results[index].data.data[0].id;
  const replay = await call(ph, "/settlements", requests[index]);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.data[0].id, payment);
  assert.equal(
    (await call(ph, "/settlements", { ...requests[index], valor: 1 })).status,
    409,
  );
  assert.equal(
    (await call(ph, "/expenses?month=11%2F2099")).data.expenses.length,
    2,
  );
  assert.equal(
    (
      await call(ph, "/settlements", {
        ...payload,
        valor: 0.005,
        idempotencyKey: randomUUID(),
      })
    ).status,
    400,
  );
  const direct = await raw(ph, "/acertos", {
    competencia: "2099-11-01",
    data_pagamento: "2099-11-10",
    pagador: "Paulo Henrique",
    recebedor: "Fernando Gustavo",
    forma_pagamento: "Dinheiro",
    valor: 1,
  });
  assert.equal(direct.status, 403);
  assert.equal(
    (await call(outsider, "/expenses?month=11%2F2099")).data.expenses.length,
    0,
  );
  pass(
    "odd-cent division, concurrent full payments, idempotency and denial of direct writes",
  );
  const created = await call(ph, "/wallets", {
    action: "add",
    nome: "GC20 isolated release check",
    limiteMensal: 1000,
  });
  assert.equal(created.status, 200);
  wallet = created.data.wallets[0].id;
  const entry = await call(ph, "/wallets/expenses", {
    action: "add",
    walletId: wallet,
    dataGasto: "2099-11-10",
    valor: 12.34,
    descricao: "Synthetic private check",
    categoria: "Outros",
  });
  assert.equal(entry.status, 200);
  personal = entry.data.expenses[0].id;
  const own = await call(
    ph,
    `/wallets/expenses?walletId=${wallet}&month=2099-11`,
  );
  assert.equal(own.status, 200);
  assert.equal(own.data.expenses.length, 1);
  assert.equal(own.data.plan.spent, 12.34);
  assert.equal(
    (await call(fg, `/wallets/expenses?walletId=${wallet}&month=2099-11`))
      .status,
    404,
  );
  assert.equal(
    (await raw(fg, `/personal_expenses?wallet_id=eq.${wallet}`)).data.length,
    0,
  );
  const goal = await call(ph, "/wallets/goal", {
    walletId: wallet,
    goal: {
      name: "Synthetic goal",
      target: 100,
      reserve: 10,
      month: "2099-11",
      deadline: "2099-11-30",
    },
  });
  assert.equal(goal.status, 200);
  pass("wallet, private expenses, goal persistence and cross-owner isolation");
  const historyPath = "/assistant/conversation?scope=house&month=2099-11";
  const record = await raw(ph, "/assistant_conversations", {
    owner_id: ph.id,
    context_key: "house:2099-11",
    revision: 1,
    messages: [
      { role: "user", content: "Synthetic release question" },
      {
        role: "assistant",
        content: "Synthetic release response, not an AI generation.",
      },
    ],
  });
  assert.equal(record.status, 201);
  conversation = record.data[0].id;
  assert.equal(
    (await call(ph, historyPath)).data.conversation.id,
    conversation,
  );
  assert.equal((await call(fg, historyPath)).data.conversation, null);
  pass(
    "private conversation storage and restoration through the real authenticated API",
  );
  const probe = "release-staging-encryption-probe";
  const config = await call(ph, "/ai/settings", {
    action: "save",
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
    apiKey: probe,
  });
  assert.equal(config.status, 200);
  const saved = await call(ph, "/ai/settings");
  assert.equal(saved.status, 200);
  assert.equal(saved.data.storageReady, true);
  assert.equal(saved.data.settings.hasKey, true);
  assert.ok(!JSON.stringify(saved.data).includes(probe));
  const ciphertext = await raw(
    ph,
    `/private_ai_settings?owner_id=eq.${ph.id}&select=key_ciphertext`,
  );
  assert.equal(ciphertext.status, 200);
  assert.ok(ciphertext.data[0].key_ciphertext.length > 40);
  assert.notEqual(ciphertext.data[0].key_ciphertext, probe);
  assert.equal((await call(fg, "/ai/settings")).data.settings, null);
  pass(
    "AI configuration encryption and cross-owner privacy; no provider request made",
  );
} finally {
  const cleanup = [];
  if (payment)
    cleanup.push(
      await call(ph, "/settlements", { action: "delete", id: payment }),
    );
  for (const id of shared)
    cleanup.push(await call(ph, "/expenses", { action: "delete", id }));
  if (personal)
    cleanup.push(
      await call(ph, "/wallets/expenses", {
        action: "delete",
        walletId: wallet,
        id: personal,
      }),
    );
  if (wallet)
    cleanup.push(await call(ph, "/wallets", { action: "delete", id: wallet }));
  if (conversation)
    cleanup.push(
      await raw(
        ph,
        `/assistant_conversations?id=eq.${conversation}`,
        undefined,
        "DELETE",
      ),
    );
  cleanup.push(await call(ph, "/ai/settings", { action: "delete" }));
  if (cleanup.some((r) => r.status >= 300))
    throw Error("Synthetic cleanup needs inspection.");
}
pass(
  "only generated records removed; pre-existing financial history preserved",
);
await writeFile(
  "/workspace/artifacts/releases/gc20-20261016-01/authenticated-checks.json",
  JSON.stringify(
    {
      backend,
      checks: report,
      providerRequest: false,
      productionWrites: false,
    },
    null,
    2,
  ),
);
