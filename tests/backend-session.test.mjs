import test from "node:test";
import assert from "node:assert/strict";
process.env.GASTOS_AUTH_BASE_URL = "https://auth.test";
const { default: handler } = await import("../backend/index.mjs");
for (const status of [503, 429])
  test(
    "falha temporária do servidor de autenticação retorna 503 e não expiração: " +
      status,
    async () => {
      const original = globalThis.fetch;
      globalThis.fetch = async () => new Response("", { status });
      try {
        const response = await handler(
          new Request("https://test/session", {
            headers: { authorization: "Bearer token" },
          }),
        );
        assert.equal(response.status, 503);
        assert.equal((await response.json()).error, "AUTH_UNAVAILABLE");
      } finally {
        globalThis.fetch = original;
      }
    },
  );
test("falha de rede na autenticação retorna indisponibilidade, enquanto credenciais inválidas retornam 401", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const request = () =>
      new Request("https://test/session", {
        headers: { authorization: "Bearer token" },
      });
    assert.equal((await handler(request())).status, 503);
    globalThis.fetch = async () => new Response("", { status: 401 });
    assert.equal((await handler(request())).status, 401);
  } finally {
    globalThis.fetch = original;
  }
});
