import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { allRows } from "../backend/data/rows.mjs";
import { createExpensesRouter } from "../backend/routes/expenses.mjs";
import { calculateSettlement } from "../backend/settlements/calculator.mjs";

test("paginação respeita limite menor do servidor e lê todos os registros", async () => {
  const offsets = [];
  const result = await allRows(
    async (path) => {
      const offset = Number(
        new URL("https://test" + path).searchParams.get("offset"),
      );
      offsets.push(offset);
      const rows = Array.from({ length: Math.min(2, 5 - offset) }, (_, i) => ({
        id: offset + i,
      }));
      return Response.json(rows, {
        headers: { "content-range": `${offset}-${offset + rows.length - 1}/5` },
      });
    },
    "/gastos?select=id",
    "jwt",
  );
  assert.equal(result.length, 5);
  assert.deepEqual(offsets, [0, 2, 4]);
});
test("sem metadados, pagina até confirmar página vazia mesmo após página curta", async () => {
  const result = await allRows(
    async (path) => {
      const offset = Number(
        new URL("https://test" + path).searchParams.get("offset"),
      );
      return Response.json(offset < 3 ? [{ id: offset }] : []);
    },
    "/gastos?select=id",
    "jwt",
  );
  assert.equal(result.length, 3);
});
for (const scenario of ["envelope", "range", "empty", "limit"])
  test(`paginação falha explicitamente: ${scenario}`, async () => {
    const api = async () =>
      scenario === "envelope"
        ? Response.json({ rows: [] })
        : scenario === "range"
          ? Response.json([{ id: 1 }], {
              headers: { "content-range": "2-2/3" },
            })
          : scenario === "empty"
            ? Response.json([], { headers: { "content-range": "*/3" } })
            : Response.json([{ id: 1 }, { id: 2 }]);
    await assert.rejects(
      allRows(api, "/gastos?select=id", "jwt", { maxRows: 1 }),
    );
  });
test("browser e backend compartilham cálculo exato e rejeitam autores desconhecidos", () => {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync("js/core/settlements.js", "utf8"),
    context,
  );
  const expenses = [
    { usuario: "Fernando Gustavo", valor: "0.07", forma_pagamento: "Dinheiro" },
  ];
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        context.window.GastosSettlementCore.calculate(expenses, [], "Dinheiro"),
      ),
    ),
    calculateSettlement(expenses, [], "Dinheiro"),
  );
  assert.throws(
    () => calculateSettlement([{ usuario: "Desconhecido", valor: 1 }]),
    /Participante/,
  );
  assert.throws(() =>
    calculateSettlement([{ usuario: "Paulo Henrique", valor: 0.005 }]),
  );
});
test("fronteira compartilhada rejeita valores e datas inválidos sem gravar", async () => {
  let writes = 0;
  const router = createExpensesRouter({
    requireAuth: async () => ({
      auth: { jwt: "jwt", user: { name: "Paulo Henrique" } },
    }),
    readJson: (r) => r.json(),
    json: (_r, status, body) => Response.json(body, { status }),
    dataApi: async () => {
      writes++;
      return Response.json([]);
    },
  });
  for (const patch of [
    { valor: 0.005 },
    { dataGasto: "2026-02-30" },
    { descricao: " " },
    { categoria: "Inventada" },
    { formaPagamento: "Inventado" },
  ]) {
    const req = new Request("https://test/expenses", {
      method: "POST",
      body: JSON.stringify({
        action: "add",
        valor: 1,
        dataGasto: "2026-10-14",
        descricao: "Mercado",
        ...patch,
      }),
    });
    assert.equal((await router(req, new URL(req.url))).status, 400);
  }
  assert.equal(writes, 0);
});
test("consulta compartilhada mantém intervalo e ordem determinística separados", async () => {
  const paths = [];
  const router = createExpensesRouter({
    requireAuth: async () => ({ auth: { jwt: "jwt" } }),
    json: (_r, status, body) => Response.json(body, { status }),
    monthRange: () => ({ start: "2026-09-01", end: "2026-10-01" }),
    dataApi: async (path) => {
      paths.push(path);
      return Response.json([{ id: "one" }], {
        headers: { "content-range": "0-0/1" },
      });
    },
  });
  const req = new Request("https://test/expenses?month=09%2F2026");
  const response = await router(req, new URL(req.url));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).complete, true);
  const params = new URL("https://test" + paths[0]).searchParams;
  assert.deepEqual(params.getAll("data"), ["gte.2026-09-01", "lt.2026-10-01"]);
  assert.equal(params.get("order"), "data.desc,created_at.desc,id.desc");
});
test("mudança do total ou repetição entre páginas não publica um subtotal como completo", async () => {
  for (const duplicate of [false, true]) {
    let page = 0;
    await assert.rejects(
      allRows(
        async () => {
          page++;
          return Response.json([{ id: duplicate ? "same" : page }], {
            headers: {
              "content-range": `${page - 1}-${page - 1}/${page === 1 || duplicate ? 3 : 4}`,
            },
          });
        },
        "/gastos?select=id",
        "jwt",
      ),
      /lista mudou/,
    );
  }
});
