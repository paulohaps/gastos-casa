import assert from "node:assert/strict";
import { state, call, status, save } from "./client.mjs";
// Only generated identities and the owned conversation from this run are eligible.
for (const label of ["ph", "fg"]) {
  const account = state.accounts.find((a) => a.label === label);
  assert.match(
    account?.email || "",
    /^qa-(ph|fg)-[a-f0-9-]+@example\.invalid$/,
  );
  assert.match(state.fixture.aiKeys?.[label] || "", /^e2e-contract-/);
  const path = "/assistant/conversation?scope=house&month=" + state.fixture.iso;
  const { conversation } = status(
    await call(label, path),
    200,
    "owned QA conversation",
  );
  if (conversation)
    status(
      await call(
        label,
        path,
        { id: conversation.id, revision: conversation.revision },
        "DELETE",
      ),
      200,
      "remove simulated response",
    );
  status(
    await call(label, "/ai/settings", { action: "delete" }),
    200,
    "remove fake provider settings",
  );
  assert.equal(
    status(await call(label, "/ai/settings"), 200, "verify settings removed")
      .settings,
    null,
  );
  assert.equal(
    status(await call(label, path), 200, "verify conversation removed")
      .conversation,
    null,
  );
}
delete state.fixture.aiKeys;
state.fixture.providerCleared = true;
await save();
console.log(
  "Synthetic provider settings and simulated conversations removed; real users untouched.",
);
