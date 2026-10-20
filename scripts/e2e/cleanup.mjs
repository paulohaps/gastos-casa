import { state, call, status, save } from "./client.mjs";
if (!state.fixture) {
  console.log("No fixture to clean");
  process.exit(0);
}
const f = state.fixture;
// Only IDs recorded by this run are eligible; this never deletes by month or category.
for (const p of f.payments || []) {
  const r = await call(p.label, "/settlements", { action: "delete", id: p.id });
  if (![200, 404].includes(r.status)) status(r, 200, "cleanup payment");
}
for (const p of f.personal || []) {
  const r = await call(p.label, "/wallets/expenses", {
    action: "delete",
    walletId: f.walletId,
    id: p.id,
  });
  if (![200, 404].includes(r.status)) status(r, 200, "cleanup private expense");
}
for (const w of f.wallets || []) {
  const r = await call(w.label, "/wallets", { action: "delete", id: w.id });
  if (![200, 404].includes(r.status)) status(r, 200, "cleanup wallet");
}
for (const e of f.shared || []) {
  const r = await call(e.label, "/expenses", { action: "delete", id: e.id });
  if (![200, 404].includes(r.status)) status(r, 200, "cleanup shared expense");
}
state.previousRuns ||= [];
state.previousRuns.push({
  runId: f.runId,
  cleanedAt: new Date().toISOString(),
});
delete state.fixture;
await save();
console.log(
  "Tracked synthetic financial records removed; ledger retained by design.",
);
