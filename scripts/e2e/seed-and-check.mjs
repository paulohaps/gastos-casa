import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { settlementSummary } from "../../js/core/settlement-summary.mjs";
import { state, save, call, status, track } from "./client.mjs";
const month = "11/2001",
  iso = "2001-11",
  runId = randomUUID();
if (state.fixture)
  throw Error("Fixture already seeded; do not replay setup without cleanup");
state.fixture = {
  month,
  iso,
  runId,
  shared: [],
  payments: [],
  wallets: [],
  personal: [],
  checks: [],
};
await save();
function pass(label) {
  state.fixture.checks.push(label);
  console.log("PASS: " + label);
}
for (const label of ["ph", "fg"]) {
  const data = status(
    await call(label, "/settlements?month=" + encodeURIComponent(month)),
    200,
    "settlements",
  );
  assert.equal(data.complete, true);
  assert.equal(data.atomicSettlements, true);
  assert.deepEqual(data.settlements, []);
}
assert.deepEqual(
  status(
    await call("outsider", "/expenses?month=" + encodeURIComponent(month)),
    200,
    "outsider read",
  ).expenses,
  [],
);
pass("Native Auth/JWT, complete settlement policy and outsider isolation");
const body = (value, method = "Dinheiro", description = "Teste integrado") => ({
  action: "add",
  dataGasto: iso + "-12",
  valor: value,
  descricao: description + " " + runId,
  categoria: "Mercado",
  formaPagamento: method,
  idempotencyKey: randomUUID(),
});
const first = body(100, "Dinheiro", "QA PH");
const simultaneous = await Promise.all([
  call("ph", "/expenses", first),
  call("ph", "/expenses", first),
]);
for (const r of simultaneous)
  if (r.data?.data?.[0]?.id) await track("shared", r.data.data[0].id, "ph");
for (const r of simultaneous) status(r, 200, "idempotent expense");
assert.equal(simultaneous[0].data.data[0].id, simultaneous[1].data.data[0].id);
assert.deepEqual(simultaneous.map((r) => r.data.replayed).sort(), [
  false,
  true,
]);
status(
  await call("ph", "/expenses", { ...first, valor: 100.01 }),
  409,
  "payload conflict",
);
status(await call("ph", "/expenses", body(0.005)), 400, "fractional cents");
for (const [label, value, method] of [
  ["fg", 200, "Dinheiro"],
  ["ph", 60, "Vale"],
]) {
  const data = status(
    await call(label, "/expenses", body(value, method, "QA " + label)),
    200,
    "seed expense",
  );
  await track("shared", data.data[0].id, label);
}
pass("Idempotent creation, payload conflicts and exact cents");
const temporary = status(
  await call("ph", "/expenses", body(5, "Dinheiro", "QA editar")),
  200,
  "temporary expense",
);
const temporaryId = temporary.data[0].id;
await track("shared", temporaryId, "ph");
status(
  await call("ph", "/expenses", {
    ...body(7, "Dinheiro", "QA editado"),
    action: "update",
    id: temporaryId,
  }),
  200,
  "edit expense",
);
status(
  await call("ph", "/expenses", { action: "delete", id: temporaryId }),
  200,
  "delete expense",
);
let expenses = status(
  await call("ph", "/expenses?month=" + encodeURIComponent(month)),
  200,
  "read expenses",
).expenses;
assert.equal(
  expenses.reduce((s, r) => s + Math.round(Number(r.valor) * 100), 0),
  36000,
);
assert.equal(expenses.length, 3);
pass("Edit and explicit deletion preserve baseline totals");
const payment = {
  action: "add",
  month,
  dataPagamento: iso + "-20",
  recebedor: "Fernando Gustavo",
  formaPagamento: "Dinheiro",
  valor: 10,
  observacao: "QA pagamento " + runId,
  idempotencyKey: randomUUID(),
};
const payments = await Promise.all([
  call("ph", "/settlements", payment),
  call("ph", "/settlements", payment),
]);
for (const r of payments)
  if (r.data?.data?.[0]?.id) await track("payments", r.data.data[0].id, "ph");
for (const r of payments) status(r, 200, "safe payment");
assert.equal(payments[0].data.data[0].id, payments[1].data.data[0].id);
const data = status(
  await call("ph", "/settlements?month=" + encodeURIComponent(month)),
  200,
  "read payments",
);
assert.equal(data.settlements.length, 1);
const summary = settlementSummary(expenses, data.settlements, {
  owner: "Paulo Henrique",
  months: [iso],
});
assert.equal(summary.payableCents, 4000);
assert.equal(summary.receivableCents, 3000);
status(
  await call("ph", "/settlements", {
    ...payment,
    valor: 100,
    idempotencyKey: randomUUID(),
  }),
  409,
  "overpayment",
);
assert.equal(
  status(
    await call("ph", "/expenses?month=" + encodeURIComponent(month)),
    200,
    "expenses after payment",
  ).expenses.length,
  3,
);
pass(
  "Payment replay, overpayment prevention and methods remain separate without inflating expenses",
);
const wallet = status(
  await call("ph", "/wallets", {
    action: "add",
    nome: "QA Cofre " + runId,
    limiteMensal: 1000,
  }),
  200,
  "create wallet",
).wallets[0];
await track("wallets", wallet.id, "ph");
state.fixture.walletId = wallet.id;
await save();
const personal = status(
  await call("ph", "/wallets/expenses", {
    action: "add",
    walletId: wallet.id,
    dataGasto: iso + "-13",
    valor: 25,
    descricao: "QA privado " + runId,
    categoria: "Outros",
  }),
  200,
  "private expense",
);
for (const row of personal.expenses || [])
  await track("personal", row.id, "ph");
const privateRead = status(
  await call("ph", "/wallets/expenses?walletId=" + wallet.id + "&month=" + iso),
  200,
  "read private wallet",
);
assert.equal(privateRead.plan.spent, 25);
assert.equal(privateRead.plan.remaining, 975);
assert.ok(
  !status(await call("fg", "/wallets"), 200, "other wallets").wallets.some(
    (w) => w.id === wallet.id,
  ),
);
status(
  await call("fg", "/wallets/expenses?walletId=" + wallet.id + "&month=" + iso),
  404,
  "other wallet denied",
);
pass("Private wallet, exact remaining budget and owner isolation");
for (const route of [
  "/budgets?month=" + encodeURIComponent(month),
  "/recurring",
  "/ai/settings",
])
  status(await call("ph", route), 200, "existing module " + route);
assert.equal(
  status(await call("ph", "/ai/settings"), 200, "AI storage").storageReady,
  true,
);
pass("Existing budget, recurring and encrypted AI settings endpoints");
await save();
console.log("Native fixture ready for browser flows; no production writes.");
