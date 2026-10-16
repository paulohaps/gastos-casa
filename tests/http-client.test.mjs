import test from "node:test";
import assert from "node:assert/strict";
import "../js/core/http-client.js";
const request = globalThis.GastosHttp.requestJson;
function stub(t, fetcher) {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  t.after(() => {
    globalThis.fetch = original;
  });
}
test("HTTP informa 401, 403 e 503 sem perder status e código", async (t) => {
  for (const status of [401, 403, 503]) {
    stub(t, async () =>
      Response.json({ message: "erro", error: "TEST" }, { status }),
    );
    await assert.rejects(
      request("https://test"),
      (e) => e.status === status && e.code === "TEST",
    );
  }
});
test("cancelamento do chamador cancela fetch sem virar timeout ou erro de rede", async (t) => {
  let signal;
  stub(t, (_, options) => {
    signal = options.signal;
    return new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason)),
    );
  });
  const controller = new AbortController(),
    pending = request("https://test", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(signal.aborted, true);
});
test("timeout permanece ativo durante a leitura do corpo", async (t) => {
  stub(t, (_, { signal }) =>
    Promise.resolve({
      ok: true,
      text: () =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason)),
        ),
    }),
  );
  await assert.rejects(request("https://test", {}, 10), {
    code: "REQUEST_TIMEOUT",
  });
});
test("JSON inválido e falha de rede produzem erros acionáveis", async (t) => {
  stub(t, async () => new Response("<html>erro</html>"));
  await assert.rejects(request("https://test"), { code: "INVALID_RESPONSE" });
  stub(t, async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(request("https://test"), { code: "NETWORK_ERROR" });
});
test("signal previamente abortado impede iniciar a requisição", async (t) => {
  let called = false;
  stub(t, async () => {
    called = true;
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(request("https://test", { signal: controller.signal }), {
    name: "AbortError",
  });
  assert.equal(called, false);
});
