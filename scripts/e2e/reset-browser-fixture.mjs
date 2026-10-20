import { state, call, status } from "./client.mjs";
const f = state.fixture;
if (!f?.runId) throw Error("Native fixture required");
const payments = status(
  await call("ph", "/settlements?month=" + encodeURIComponent(f.month)),
  200,
  "fixture payments",
);
for (const row of payments.settlements.filter(
  (r) => (r.observacao || "") === "QA navegador " + f.runId,
))
  status(
    await call("ph", "/settlements", { action: "delete", id: row.id }),
    200,
    "reset browser payment",
  );
const expenses = status(
  await call("ph", "/expenses?month=" + encodeURIComponent(f.month)),
  200,
  "fixture expenses",
);
for (const row of expenses.expenses.filter(
  (r) => r.descricao === "QA navegador " + f.runId,
))
  status(
    await call("ph", "/expenses", { action: "delete", id: row.id }),
    200,
    "reset browser expense",
  );
const personal = status(
  await call(
    "ph",
    "/wallets/expenses?walletId=" + f.walletId + "&month=" + f.iso,
  ),
  200,
  "fixture private",
);
for (const row of personal.expenses.filter(
  (r) => r.descricao === "QA privado navegador " + f.runId,
))
  status(
    await call("ph", "/wallets/expenses", {
      action: "delete",
      walletId: f.walletId,
      id: row.id,
    }),
    200,
    "reset browser private",
  );
for (const label of ["ph", "fg"]) {
  const path = "/assistant/conversation?scope=house&month=" + f.iso;
  const d = status(await call(label, path), 200, "fixture conversation");
  if (d.conversation)
    status(
      await call(
        label,
        path,
        { id: d.conversation.id, revision: d.conversation.revision },
        "DELETE",
      ),
      200,
      "reset synthetic conversation",
    );
}
console.log(
  "Browser fixture reset: only exact run markers and owned conversations.",
);
