import { readFile, writeFile, chmod } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
const config = JSON.parse(await readFile("release/preview.json", "utf8"));
const output = process.env.GASTOS_PREVIEW_SESSION_FILE;
if (!output) throw Error("GASTOS_PREVIEW_SESSION_FILE required");
const health = await fetch(config.backendUrl + "/health").then((r) => r.json());
if (
  health.runtime?.environment !== "preview" ||
  health.runtime.endpoint !== config.endpoint ||
  health.runtime.databaseBranch !== config.databaseBranch ||
  config.endpoint === config.productionEndpoint ||
  !new URL(config.backendUrl).hostname.startsWith(config.apiBranch + "-")
)
  throw Error("Unverified isolation");
const state = { config, accounts: [], createdAt: new Date().toISOString() };
const save = async () => {
  await writeFile(output, JSON.stringify(state), { mode: 0o600 });
  await chmod(output, 0o600);
};
await save();
for (const [label, name] of [
  ["ph", "Paulo Henrique"],
  ["fg", "Fernando Gustavo"],
  ["outsider", "QA externo"],
]) {
  const email = `qa-${label}-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString("base64url");
  const response = await fetch(config.backendUrl + "/signup", {
    method: "POST",
    headers: {
      Origin: "https://paulohaps.github.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });
  const d = await response.json();
  if (!response.ok || !d.user?.id || !d.token)
    throw Error(
      `Synthetic signup ${label} failed: HTTP ${response.status}, code ${d.error || "unknown"}`,
    );
  state.accounts.push({
    label,
    name,
    email,
    password,
    id: d.user.id,
    token: d.token,
  });
  await save();
  console.log("Synthetic identity created: " + label);
}
console.log("Session fixture saved privately; no credentials printed.");
