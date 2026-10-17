import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const sessionFile = process.env.GASTOS_RELEASE_SESSION_FILE;
if (!sessionFile) throw Error("GASTOS_RELEASE_SESSION_FILE is required.");
const state = JSON.parse(await readFile(sessionFile, "utf8"));
const backend =
  "https://br-polished-voice-a5flam43-gc20releasecheck.compute.c-1.us-east-2.aws.neon.tech";
assert.equal(state.backend, backend);
assert.equal(
  state.authOrigin,
  "https://ep-wild-wind-ac7p8wta.neonauth.sa-east-1.aws.neon.tech/release_identity/auth",
);
const dataApi =
  "https://ep-wild-wind-ac7p8wta.apirest.sa-east-1.aws.neon.tech/gastos_casa/rest/v1";
const [ph, fg, outsider] = state.accounts,
  report = [],
  shared = [],
  personal = [];
let wallet;
const headers = (a) => ({
  Origin: "https://paulohaps.github.io",
  Authorization: "Bearer " + a.token,
  "Content-Type": "application/json",
});
async function call(a, path, body) {
  const r = await fetch(backend + path, {
    method: body ? "POST" : "GET",
    headers: headers(a),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function jwt(a) {
  const c = JSON.parse(Buffer.from(a.token, "base64url").toString());
  const r = await fetch(state.authOrigin + "/token", {
    headers: {
      Cookie: c.cookieName + "=" + c.cookieValue,
      Origin: "https://paulohaps.github.io",
    },
  });
  assert.equal(r.status, 200);
  return (await r.json()).token;
}
const jwtPh = await jwt(ph),
  jwtFg = await jwt(fg);
async function raw(token, path, body, method = body ? "POST" : "GET") {
  const r = await fetch(dataApi + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
function pass(name) {
  report.push(name);
  console.log("PASS: " + name);
}
try {
  assert.equal((await call(ph, "/session")).status, 200);
  assert.equal((await call(fg, "/session")).status, 200);
  const outsiderRead = await call(outsider, "/expenses?month=11%2F2099");
  assert.equal(outsiderRead.status, 200);
  assert.deepEqual(outsiderRead.data.expenses, []);
  pass("Native sessions/JWT and household authorization");
  const key = randomUUID(),
    body = {
      action: "add",
      dataGasto: "2099-11-13",
      valor: 0.3,
      descricao: "GC20 recovery isolated " + key,
      categoria: "Mercado",
      formaPagamento: "Dinheiro",
      idempotencyKey: key,
    };
  const results = await Promise.all([
    call(ph, "/expenses", body),
    call(ph, "/expenses", body),
  ]);
  for (const r of results) {
    const id = r.data?.data?.[0]?.id;
    if (typeof id === "string" && !shared.includes(id)) shared.push(id);
  }
  for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(results[0].data.data[0].id, results[1].data.data[0].id);
  assert.deepEqual(results.map((r) => r.data.replayed).sort(), [false, true]);
  assert.equal(
    (await call(ph, "/expenses", { ...body, valor: 0.31 })).status,
    409,
  );
  const ledger = await raw(
    jwtPh,
    "/expense_requests?select=request_key&request_key=eq." + key,
  );
  assert.equal(ledger.status, 200);
  assert.equal(ledger.data.length, 1);
  const hidden = await raw(
    jwtFg,
    "/expense_requests?select=request_key&request_key=eq." + key,
  );
  assert.equal(hidden.status, 200);
  assert.deepEqual(hidden.data, []);
  pass(
    "Native atomic expense creation, replay, payload conflict and private ledger",
  );
  assert.equal(
    (
      await call(ph, "/expenses", {
        ...body,
        idempotencyKey: randomUUID(),
        valor: 0.005,
      })
    ).status,
    400,
  );
  const del = await call(ph, "/expenses", { action: "delete", id: shared[0] });
  assert.equal(del.status, 200);
  const replay = await call(ph, "/expenses", body);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.deepEqual(
    (await raw(jwtPh, "/gastos?select=id&id=eq." + shared[0])).data,
    [],
  );
  pass("Exact cents; replay after explicit deletion does not recreate expense");
  const legacy = { ...body };
  delete legacy.idempotencyKey;
  const legacyResult = await call(ph, "/expenses", legacy);
  if (legacyResult.data?.data?.[0]?.id)
    shared.push(legacyResult.data.data[0].id);
  assert.equal(legacyResult.status, 200);
  assert.equal(legacyResult.data.idempotent, false);
  pass(
    "Legacy frontend expense contract remains usable without claiming retry idempotency",
  );

  const w = await call(ph, "/wallets", {
    action: "add",
    nome: "Cofre sintético recuperação",
    limiteMensal: 100,
  });
  assert.equal(w.status, 200, JSON.stringify(w.data));
  wallet = w.data.wallets[0].id;
  // More than one server page, all synthetic and scoped to this new private wallet.
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: randomUUID(),
    owner_id: ph.id,
    wallet_id: wallet,
    data: "2099-11-13",
    valor: 0.01,
    descricao: "GC20 pagination " + i,
    categoria: "Outros",
  }));
  personal.push(...rows.map((r) => r.id));
  const inserted = await raw(jwtPh, "/personal_expenses", rows);
  assert.equal(inserted.status, 201, JSON.stringify(inserted.data));
  const read = await call(
    ph,
    `/wallets/expenses?walletId=${wallet}&month=2099-11`,
  );
  assert.equal(read.status, 200, JSON.stringify(read.data));
  assert.equal(read.data.expenses.length, 1001);
  assert.equal(read.data.plan.spent, 10.01);
  assert.equal(read.data.plan.remaining, 89.99);
  const denied = await call(
    fg,
    `/wallets/expenses?walletId=${wallet}&month=2099-11`,
  );
  assert.equal(denied.status, 404);
  assert.deepEqual(
    (await raw(jwtFg, `/personal_expenses?select=id&wallet_id=eq.${wallet}`))
      .data,
    [],
  );
  pass(
    "Native wallet pagination above 1000 records, exact totals and owner RLS",
  );
  const health = await fetch(backend + "/health");
  assert.equal((await health.json()).version, "2026-10-17.3");
  pass("Isolated deployed backend version verified");
} finally {
  // Only IDs returned by synthetic writes in the allowlisted isolated endpoint.
  for (let i = 0; i < personal.length; i += 100) {
    const ids = personal.slice(i, i + 100);
    const r = await raw(
      jwtPh,
      "/personal_expenses?id=in.(" + ids.join(",") + ")",
      null,
      "DELETE",
    );
    assert.ok(r.status < 300);
  }
  if (wallet) {
    const r = await call(ph, "/wallets", { action: "delete", id: wallet });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  for (const id of shared) {
    const r = await raw(jwtPh, "/gastos?id=eq." + id, null, "DELETE");
    assert.ok(r.status < 300);
  }
  if (process.env.GASTOS_NATIVE_REPORT)
    await writeFile(
      process.env.GASTOS_NATIVE_REPORT,
      JSON.stringify(
        {
          branch: "br-dry-sea-ac9sj8ie",
          backend,
          checks: report,
          syntheticFinancialCleanup: true,
          productionChanged: false,
        },
        null,
        2,
      ),
    );
  console.log("Synthetic financial records cleaned in isolated branch only.");
}
