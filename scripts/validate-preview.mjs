import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  BACKEND_VERSION,
  PREVIEW_CONTRACT,
} from "../backend/runtime-config.mjs";
export function validatePreview(profile, health) {
  const url = new URL(profile.backendUrl);
  if (
    url.protocol !== "https:" ||
    !url.hostname.startsWith(profile.apiBranch + "-") ||
    profile.apiBranch === "br-polished-voice-a5flam43" ||
    profile.databaseBranch === "br-floral-night-acsx867x" ||
    profile.endpoint === profile.productionEndpoint
  )
    throw Error("PREVIEW_ISOLATION_MISMATCH");
  if (health?.qaProvider) throw Error("PREVIEW_BACKEND_TEST_DOUBLE");
  const runtime = health?.runtime;
  if (
    health.ok !== true ||
    health.version !== BACKEND_VERSION ||
    runtime?.environment !== "preview" ||
    runtime.contract !== PREVIEW_CONTRACT ||
    runtime.endpoint !== profile.endpoint ||
    runtime.databaseBranch !== profile.databaseBranch ||
    runtime.apiBranch !== profile.apiBranch
  )
    throw Error("PREVIEW_BACKEND_INCOMPATIBLE");
  return true;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const profile = JSON.parse(
    await readFile(process.argv[2] || "release/preview.json", "utf8"),
  );
  const response = await fetch(profile.backendUrl + "/health", {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error("PREVIEW_HEALTH_UNAVAILABLE");
  validatePreview(profile, await response.json());
  for (const path of [
    "/session",
    "/settlements?month=11%2F2001",
    "/wallets",
    "/ai/settings",
  ]) {
    const r = await fetch(profile.backendUrl + path, {
      signal: AbortSignal.timeout(20000),
    });
    if (![401, 403].includes(r.status))
      throw Error("PREVIEW_AUTH_CONTRACT_MISMATCH");
  }
  console.log(
    "Preview backend: version, isolation and protected routes verified.",
  );
}
