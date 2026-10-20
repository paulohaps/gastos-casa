import { randomUUID } from "node:crypto";
import { state, call, status, save } from "./client.mjs";
const health = await fetch(state.config.backendUrl + "/health").then((r) =>
  r.json(),
);
if (health.qaProvider !== "contract-stub")
  throw Error(
    "Contract stub not active; never send synthetic keys to a real provider",
  );
for (const [label, provider, model] of [
  ["ph", "deepseek", "deepseek-chat"],
  ["fg", "gemini", "gemini-2.5-flash"],
]) {
  const apiKey = "e2e-contract-" + randomUUID();
  state.fixture.aiKeys ||= {};
  state.fixture.aiKeys[label] = apiKey;
  await save();
  status(
    await call(label, "/ai/settings", {
      action: "save",
      provider,
      model,
      apiKey,
    }),
    200,
    "save synthetic AI settings",
  );
  status(
    await call(label, "/ai/settings", { action: "test", provider, model }),
    200,
    "test contract provider " + provider,
  );
  const settings = status(
    await call(label, "/ai/settings"),
    200,
    "read masked AI settings",
  );
  if (
    settings.settings?.hasKey !== true ||
    JSON.stringify(settings).includes(apiKey)
  )
    throw Error("AI settings secrecy failed");
  console.log(
    "PASS: " +
      provider +
      " configuration, encryption, masked read and provider adapter (simulated upstream)",
  );
}
await save();
