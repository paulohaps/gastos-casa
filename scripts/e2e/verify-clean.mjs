import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { state, call, status } from "./client.mjs";
import { validatePreview } from "../validate-preview.mjs";
import { settlementSummary } from "../../js/core/settlement-summary.mjs";
const health = await fetch(state.config.backendUrl + "/health").then((r) =>
  r.json(),
);
assert.equal(validatePreview(state.config, health), true);
assert.equal(state.fixture.providerCleared, true);
const expenses = status(
  await call(
    "ph",
    "/expenses?month=" + encodeURIComponent(state.fixture.month),
  ),
  200,
  "clean expenses",
).expenses;
const payments = status(
  await call(
    "ph",
    "/settlements?month=" + encodeURIComponent(state.fixture.month),
  ),
  200,
  "clean payments",
);
assert.equal(payments.atomicSettlements, true);
assert.equal(payments.complete, true);
assert.equal(
  expenses.reduce((sum, row) => sum + Math.round(Number(row.valor) * 100), 0),
  36000,
);
const summary = settlementSummary(expenses, payments.settlements, {
  owner: "Paulo Henrique",
  months: [state.fixture.iso],
});
assert.equal(summary.payableCents, 3500);
assert.equal(summary.receivableCents, 3000);
const privateData = status(
  await call(
    "ph",
    "/wallets/expenses?walletId=" +
      state.fixture.walletId +
      "&month=" +
      state.fixture.iso,
  ),
  200,
  "clean private expenses",
);
assert.equal(privateData.plan.spent, 28.5);
assert.equal(privateData.plan.remaining, 971.5);
assert.deepEqual(
  status(
    await call(
      "outsider",
      "/expenses?month=" + encodeURIComponent(state.fixture.month),
    ),
    200,
    "outsider",
  ).expenses,
  [],
);
assert.equal(
  status(await call("ph", "/ai/settings"), 200, "no fake key").settings,
  null,
);
const missingKey = status(
  await call("ph", "/assistant/chat", {
    context: { scope: "house", month: state.fixture.iso },
    messages: [{ role: "user", content: "Quanto devo a Fernando?" }],
  }),
  409,
  "missing key",
);
assert.equal(missingKey.code, "AI_NOT_CONFIGURED");
status(
  await call("ph", "/session"),
  200,
  "session preserved after unconfigured AI",
);
const report = {
  passed: true,
  backendVersion: health.version,
  qaProvider: false,
  paidProviderCalls: false,
  exactExpenseCents: 36000,
  payableCents: 3500,
  receivableCents: 3000,
  walletSpentCents: 2850,
  walletRemainingCents: 97150,
  atomicSettlements: true,
  privateOwnerIsolation: true,
  missingKey: { status: 409, code: missingKey.code, sessionPreserved: true },
  productionWrites: false,
};
await writeFile(
  (process.env.GASTOS_PREVIEW_REPORT_DIR ||
    "/workspace/artifacts/integrated-20261020") + "/clean-backend.json",
  JSON.stringify(report, null, 2),
);
console.log(
  "PASS: clean backend, exact balances, private wallet, unconfigured AI and preserved session.",
);
