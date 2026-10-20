import { readFile, writeFile } from "node:fs/promises";
export const sessionPath = process.env.GASTOS_PREVIEW_SESSION_FILE;
if (!sessionPath) throw Error("GASTOS_PREVIEW_SESSION_FILE required");
export const state = JSON.parse(await readFile(sessionPath, "utf8"));
const expected = JSON.parse(await readFile("release/preview.json", "utf8"));
if (
  state.config.backendUrl !== expected.backendUrl ||
  state.config.endpoint !== expected.endpoint ||
  expected.endpoint === expected.productionEndpoint
)
  throw Error("Fixture isolation mismatch");
export const save = () =>
  writeFile(sessionPath, JSON.stringify(state), { mode: 0o600 });
export async function call(label, path, body, method = body ? "POST" : "GET") {
  const a = state.accounts.find((a) => a.label === label);
  if (!a) throw Error("Synthetic account missing");
  const r = await fetch(state.config.backendUrl + path, {
    method,
    headers: {
      Origin: "https://paulohaps.github.io",
      Authorization: "Bearer " + a.token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  return { status: r.status, data };
}
export function status(result, expected, label) {
  if (result.status !== expected)
    throw Error(
      `${label}: expected HTTP ${expected}, got ${result.status}, code ${result.data?.error || result.data?.code || "none"}`,
    );
  return result.data;
}
export async function track(kind, id, label) {
  if (typeof id !== "string") throw Error("Synthetic resource missing ID");
  state.fixture[kind] ||= [];
  if (!state.fixture[kind].some((row) => row.id === id))
    state.fixture[kind].push({ id, label });
  await save();
}
