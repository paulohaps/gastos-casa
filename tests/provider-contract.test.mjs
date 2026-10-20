import test from "node:test";
import assert from "node:assert/strict";
import { installContractProvider } from "../scripts/e2e/provider-contract.mjs";
test("simulador de provedor é proibido em produção e bloqueia chaves reais", async () => {
  const original = globalThis.fetch;
  assert.throws(() => installContractProvider({}), /REQUIRES_ISOLATION/);
  assert.equal(globalThis.fetch, original);
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
  try {
    installContractProvider(env);
    const request = (key) =>
      fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { authorization: "Bearer " + key },
        body: JSON.stringify({ stream: false }),
      });
    assert.equal((await request("non-test-key")).status, 401);
    assert.equal(
      (await (await request("e2e-contract-synthetic")).json()).choices[0]
        .message.content,
      "OK",
    );
  } finally {
    globalThis.fetch = original;
  }
});
