import test from "node:test";
import assert from "node:assert/strict";
import { createSettlementsRouter } from "../backend/routes/settlements.mjs";
const url = new URL("https://example.test/settlements");
const base = {
  action: "add",
  month: "09/2026",
  dataPagamento: "2026-09-22",
  recebedor: "Fernando Gustavo",
  formaPagamento: "Dinheiro",
  observacao: "",
  idempotencyKey: "request-test-0001",
};
function setup({
  user = "Paulo Henrique",
  status = 200,
  result = [{ id: "new" }],
} = {}) {
  const calls = [];
  const router = createSettlementsRouter({
    requireAuth: async () => ({
      auth: { jwt: "jwt", token: "token", user: { name: user } },
    }),
    readJson: (r) => r.json(),
    json: (_r, s, b) => Response.json(b, { status: s }),
    monthRange: (m) => (m === "09/2026" ? {} : null),
    monthToDb: (m) => (m === "09/2026" ? "2026-09" : null),
    dataApi: async (path, options) => {
      calls.push({ path, ...options });
      return Response.json(result, { status });
    },
  });
  return {
    calls,
    send: (body) =>
      router(
        new Request(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...base, ...body }),
        }),
        url,
      ),
  };
}
test("acerto utiliza somente RPC atômica, com chave e identidade da sessão", async () => {
  const { send, calls } = setup();
  assert.equal(
    (await send({ valor: 65, pagador: "Fernando Gustavo" })).status,
    200,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/rpc/record_settlement");
  const row = JSON.parse(calls[0].body);
  assert.equal(row.p_competencia, "2026-09-01");
  assert.equal(row.p_valor, 65);
  assert.equal(row.p_request_key, base.idempotencyKey);
  assert.equal("p_pagador" in row, false);
});
test("conflito atômico não grava por fallback nem descarta o conflito", async () => {
  const { send, calls } = setup({ status: 409 });
  assert.equal((await send({ valor: 70 })).status, 409);
  assert.equal(calls.length, 1);
});
test("RPC ausente retorna indisponível e nunca usa INSERT inseguro", async () => {
  const { send, calls } = setup({ status: 404 });
  assert.equal((await send({ valor: 65 })).status, 503);
  assert.equal(calls[0].path, "/rpc/record_settlement");
});
for (const [field, value] of [
  ["valor", 0.005],
  ["valor", 0],
  ["valor", -1],
  ["valor", Infinity],
  ["dataPagamento", "2026-02-30"],
  ["idempotencyKey", ""],
  ["recebedor", "Outra pessoa"],
])
  test(`validação de acerto rejeita ${field}=${value}`, async () => {
    const { send, calls } = setup();
    assert.equal((await send({ valor: 65, [field]: value })).status, 400);
    assert.equal(calls.length, 0);
  });
test("pagador fora da regra compartilhada é rejeitado antes da RPC", async () => {
  const { send, calls } = setup({ user: "Outra pessoa" });
  assert.equal((await send({ valor: 65 })).status, 400);
  assert.equal(calls.length, 0);
});
test("confirmação da RPC inválida não vira sucesso financeiro", async () => {
  const { send } = setup({ result: { id: "new" } });
  assert.equal((await send({ valor: 65 })).status, 502);
});
test("conflito preserva saldo restante informado pela operação atômica", async () => {
  const { send } = setup({
    status: 409,
    result: { code: "PT409", details: JSON.stringify({ remaining: 65 }) },
  });
  const response = await send({ valor: 70 });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).details.remaining, 65);
});
