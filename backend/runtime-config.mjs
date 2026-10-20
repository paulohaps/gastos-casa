const PRODUCTION_ENDPOINT = "ep-damp-meadow-acm7ggxa";
const PRODUCTION_DATABASE_BRANCH = "br-floral-night-acsx867x";
const PRODUCTION_API_BRANCH = "br-polished-voice-a5flam43";
export const BACKEND_VERSION = "2026-10-20.1";
export const PREVIEW_CONTRACT = "integrated-finance-v1";

// A Function clone can inherit URLs pointing at its parent's external services.
// Refuse to start a preview whose Auth and Data API are not the same isolated endpoint.
export function runtimeConfig(env) {
  if (env.GASTOS_ENVIRONMENT !== "preview")
    return { environment: "production" };
  const endpoint = env.GASTOS_PREVIEW_ENDPOINT;
  const databaseBranch = env.GASTOS_PREVIEW_DATABASE_BRANCH;
  const apiBranch = env.GASTOS_PREVIEW_API_BRANCH;
  const invalid = () => {
    throw new Error("PREVIEW_CONFIGURATION_INVALID");
  };
  if (
    !/^ep-[a-z0-9-]+$/.test(endpoint || "") ||
    endpoint === PRODUCTION_ENDPOINT ||
    !/^br-[a-z0-9-]+$/.test(databaseBranch || "") ||
    databaseBranch === PRODUCTION_DATABASE_BRANCH ||
    !/^br-[a-z0-9-]+$/.test(apiBranch || "") ||
    apiBranch === PRODUCTION_API_BRANCH
  )
    invalid();
  let auth, data;
  try {
    auth = new URL(env.GASTOS_AUTH_BASE_URL);
    data = new URL(env.GASTOS_DATA_API_URL);
  } catch {
    invalid();
  }
  if (
    auth.protocol !== "https:" ||
    data.protocol !== "https:" ||
    auth.username ||
    auth.password ||
    data.username ||
    data.password ||
    auth.hostname !== endpoint + ".neonauth.sa-east-1.aws.neon.tech" ||
    data.hostname !== endpoint + ".apirest.sa-east-1.aws.neon.tech" ||
    auth.pathname !== "/gastos_casa/auth" ||
    data.pathname !== "/gastos_casa/rest/v1" ||
    auth.search ||
    data.search ||
    auth.hash ||
    data.hash
  )
    invalid();
  return {
    environment: "preview",
    contract: PREVIEW_CONTRACT,
    endpoint,
    databaseBranch,
    apiBranch,
  };
}
