import test from "node:test";
import assert from "node:assert/strict";
import { runtimeConfig, PREVIEW_CONTRACT } from "../backend/runtime-config.mjs";
const env = {
  GASTOS_ENVIRONMENT: "preview",
  GASTOS_PREVIEW_ENDPOINT: "ep-isolated-test",
  GASTOS_PREVIEW_DATABASE_BRANCH: "br-isolated-data",
  GASTOS_PREVIEW_API_BRANCH: "br-isolated-api",
  GASTOS_AUTH_BASE_URL:
    "https://ep-isolated-test.neonauth.sa-east-1.aws.neon.tech/gastos_casa/auth",
  GASTOS_DATA_API_URL:
    "https://ep-isolated-test.apirest.sa-east-1.aws.neon.tech/gastos_casa/rest/v1",
};
test("prévia exige os dois serviços na mesma base isolada", () => {
  assert.equal(runtimeConfig(env).contract, PREVIEW_CONTRACT);
  for (const patch of [
    {
      GASTOS_AUTH_BASE_URL:
        "https://ep-damp-meadow-acm7ggxa.neonauth.sa-east-1.aws.neon.tech/gastos_casa/auth",
    },
    {
      GASTOS_DATA_API_URL:
        "https://other.apirest.sa-east-1.aws.neon.tech/gastos_casa/rest/v1",
    },
    { GASTOS_PREVIEW_DATABASE_BRANCH: "br-floral-night-acsx867x" },
    { GASTOS_PREVIEW_API_BRANCH: "br-polished-voice-a5flam43" },
    { GASTOS_AUTH_BASE_URL: env.GASTOS_AUTH_BASE_URL + "?next=production" },
    { GASTOS_PREVIEW_ENDPOINT: undefined },
    {
      GASTOS_AUTH_BASE_URL: env.GASTOS_AUTH_BASE_URL.replace("https:", "http:"),
    },
  ])
    assert.throws(
      () => runtimeConfig({ ...env, ...patch }),
      /PREVIEW_CONFIGURATION_INVALID/,
    );
});
test("produção preserva configuração existente e não publica destinos ou segredos", () => {
  assert.deepEqual(
    runtimeConfig({
      GASTOS_AUTH_BASE_URL: "https://auth.test",
      AI_SETTINGS_ENCRYPTION_KEY: "not-returned",
    }),
    { environment: "production" },
  );
  assert.ok(!JSON.stringify(runtimeConfig(env)).includes("ENCRYPTION"));
});

test("pipeline rejeita backend antigo, produção e contrato de outra base", async () => {
  const { validatePreview } = await import("../scripts/validate-preview.mjs");
  const profile = {
    backendUrl:
      "https://br-isolated-api-gastospwa.compute.c-1.us-east-2.aws.neon.tech",
    apiBranch: "br-isolated-api",
    databaseBranch: "br-isolated-data",
    endpoint: "ep-isolated-test",
    productionEndpoint: "ep-damp-meadow-acm7ggxa",
  };
  const health = {
    ok: true,
    version: "2026-10-20.1",
    runtime: runtimeConfig(env),
  };
  assert.equal(validatePreview(profile, health), true);
  for (const bad of [
    { ...health, version: "2026-09-19.10" },
    { ...health, runtime: { ...health.runtime, endpoint: "ep-wrong" } },
    { ...health, runtime: { environment: "production" } },
  ])
    assert.throws(
      () => validatePreview(profile, bad),
      /PREVIEW_BACKEND_INCOMPATIBLE/,
    );
  assert.throws(
    () => validatePreview(profile, { ...health, qaProvider: "contract-stub" }),
    /PREVIEW_BACKEND_TEST_DOUBLE/,
  );
  assert.throws(
    () =>
      validatePreview(
        {
          ...profile,
          backendUrl:
            "https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech",
        },
        health,
      ),
    /PREVIEW_ISOLATION_MISMATCH/,
  );
});
