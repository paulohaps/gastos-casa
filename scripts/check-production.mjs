import fs from "node:fs";
const config = JSON.parse(
  fs.readFileSync(
    new URL("../release/production.json", import.meta.url),
    "utf8",
  ),
);
if (config.status !== "ready")
  throw new Error("Release has not completed infrastructure validation.");
const backend =
  "https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech";
const health = await fetch(backend + "/health", {
  signal: AbortSignal.timeout(20000),
});
const data = await health.json();
if (!health.ok || data.ok !== true || data.version !== config.backend_version)
  throw new Error("Production backend does not match the approved release.");
for (const route of [
  "/wallets",
  "/ai/settings",
  "/assistant/conversation",
  "/settlements?month=10%2F2026",
]) {
  const response = await fetch(backend + route, {
    signal: AbortSignal.timeout(20000),
    headers: { Origin: "https://paulohaps.github.io" },
  });
  if (
    response.status !== 401 ||
    response.headers.get("access-control-allow-origin") !==
      "https://paulohaps.github.io"
  )
    throw new Error("Protected production route is not ready: " + route);
}
console.log("Production backend version, protected routes and CORS: OK");
