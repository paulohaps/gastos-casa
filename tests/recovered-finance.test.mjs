import test from "node:test";
import assert from "node:assert/strict";
import { comparisonPeriods, localDate, isoDate } from "../js/core/calendar.mjs";
import { createExpense } from "../backend/services/expense-operation.mjs";
import { createWalletsRouter } from "../backend/routes/wallets.mjs";
import { parseExpenses } from "../src/features/wallets/contracts.ts";
const body = {
  dataGasto: "2099-11-01",
  valor: 0.3,
  descricao: "Sintético",
  categoria: "Mercado",
  formaPagamento: "Dinheiro",
  idempotencyKey: "recovered-operation",
};
const expense = {
  id: "saved",
  data: body.dataGasto,
  valor: 0.3,
  descricao: body.descricao,
  categoria: "Mercado",
  forma_pagamento: "Dinheiro",
};
test("comparação corta ambos os meses, preserva futuros e valida calendário", () => {
  const current = [{ data: "2026-09-05" }, { data: "2026-09-30" }],
    previous = [{ data: "05/08/2026" }, { data: "30/08/2026" }];
  const p = comparisonPeriods(current, previous, "09/2026", "2026-09-22");
  assert.equal(p.current.length, 1);
  assert.equal(p.previous.length, 1);
  assert.equal(current.length, 2);
  assert.equal(
    comparisonPeriods([], [], "10/2026", "2026-09-22").available,
    false,
  );
  assert.equal(
    comparisonPeriods([], [], "03/2024", "2024-03-31").previousThrough,
    "2024-02-29",
  );
  assert.equal(
    comparisonPeriods([], [], "03/2025", "2025-03-31").previousThrough,
    "2025-02-28",
  );
  assert.throws(() => isoDate("2026-02-30"));
  assert.throws(() =>
    comparisonPeriods([{ data: "2026-08-01" }], [], "09/2026", "2026-09-22"),
  );
  assert.equal(localDate(new Date(2026, 8, 22, 23, 30)), "2026-09-22");
});
test("RPC conserva chave, não aceita identidade do cliente e valida confirmação", async () => {
  const calls = [];
  const api = async (path, options, jwt) => {
    calls.push({ path, args: JSON.parse(options.body), jwt });
    return Response.json({ expense, replayed: true });
  };
  const result = await createExpense(api, "jwt", {
    ...body,
    usuario: "Impostor",
  });
  assert.equal(result.replayed, true);
  assert.deepEqual(result.data, [expense]);
  assert.equal(calls[0].path, "/rpc/record_expense");
  assert.equal(calls[0].args.p_request_key, body.idempotencyKey);
  assert.equal(calls[0].args.usuario, undefined);
  for (const key of [undefined, null, "bad key", "short"]) {
    assert.equal(
      (await createExpense(api, "jwt", { ...body, idempotencyKey: key }))
        .status,
      400,
    );
  }
  assert.equal(calls.length, 1);
  for (const result of [
    null,
    {},
    { expense, replayed: "false" },
    { expense: { ...expense, valor: 0.31 }, replayed: false },
  ])
    assert.equal(
      (await createExpense(async () => Response.json(result), "jwt", body))
        .status,
      502,
    );
});
for (const status of [401, 403, 409, 404, 500, 503])
  test(`RPC ${status} não faz fallback`, async () => {
    let n = 0;
    const result = await createExpense(
      async () => {
        n++;
        return Response.json({ message: "private" }, { status });
      },
      "jwt",
      body,
    );
    assert.equal(n, 1);
    assert.equal(
      result.status,
      [401, 403, 409].includes(status) ? status : 503,
    );
    assert.doesNotMatch(result.message, /private/);
  });
const wallet = "11111111-1111-4111-8111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222";
test("Cofre lê páginas curtas com Content-Range e rejeita frações/resposta parcial", async () => {
  for (const bad of [false, "fraction", "array", "network", "duplicate"]) {
    const offsets = [];
    const router = createWalletsRouter({
      insightsService: { configured: async () => false },
      requireAuth: async () => ({ auth: { jwt: "jwt", user: { id: owner } } }),
      json: (_r, status, body) => Response.json(body, { status }),
      dataApi: async (path) => {
        if (path.startsWith("/personal_wallets"))
          return Response.json([{ id: wallet, limite_mensal: 100 }]);
        const offset = Number(
          new URL("https://t" + path).searchParams.get("offset"),
        );
        offsets.push(offset);
        if (offset === 1 && bad === "network")
          return new Response("", { status: 503 });
        return Response.json(
          [
            {
              id: bad === "duplicate" ? "same" : String(offset),
              wallet_id: wallet,
              data: "2099-11-01",
              valor: bad === "fraction" ? 0.005 : bad === "array" ? [1] : 1,
              descricao: "x",
              categoria: "Outros",
            },
          ],
          { headers: { "content-range": `${offset}-${offset}/2` } },
        );
      },
    });
    const req = new Request(
        `https://t/wallets/expenses?walletId=${wallet}&month=2099-11`,
      ),
      r = await router(req, new URL(req.url));
    if (bad) assert.equal(r.status, 503);
    else {
      assert.equal(r.status, 200);
      const result = await r.json();
      assert.equal(result.expenses.length, 2);
      assert.equal(result.plan.spent, 2);
      assert.deepEqual(offsets, [0, 1]);
    }
  }
});
test("contrato React recusa frações, dias impossíveis e totais inconsistentes", () => {
  const response = {
    expenses: [{ ...expense, data: "2099-11-01" }],
    plan: {
      month: "2099-11",
      spent: 0.3,
      budget: 1,
      remaining: 0.7,
      daily: null,
      signals: [],
    },
  };
  assert.equal(parseExpenses(response, "2099-11").plan.spent, 0.3);
  for (const patch of [{ valor: 0.005 }, { data: "2099-11-32" }])
    assert.throws(() =>
      parseExpenses(
        { ...response, expenses: [{ ...response.expenses[0], ...patch }] },
        "2099-11",
      ),
    );
  assert.throws(() =>
    parseExpenses(
      { ...response, plan: { ...response.plan, spent: 0.31 } },
      "2099-11",
    ),
  );
});

test("falha de telemetria não invalida commit e replay não repete efeitos", async () => {
  const { createExpensesRouter } = await import(
    "../backend/routes/expenses.mjs"
  );
  for (const replayed of [false, true]) {
    let learning = 0,
      telemetry = 0,
      receipt = 0;
    const router = createExpensesRouter({
      requireAuth: async () => ({
        auth: { jwt: "jwt", user: { name: "Paulo Henrique" } },
      }),
      readJson: (r) => r.json(),
      json: (_r, status, data) => Response.json(data, { status }),
      dataApi: async () => Response.json({ expense, replayed }),
      smartEntryService: {
        recordLearning: async () => {
          learning++;
          throw Error("offline");
        },
        completeTelemetry: async () => {
          telemetry++;
          throw Error("offline");
        },
      },
      receiptService: {
        registerFromExpense: async () => {
          receipt++;
          throw Error("offline");
        },
      },
    });
    const req = new Request("https://t/expenses", {
      method: "POST",
      body: JSON.stringify({
        ...body,
        action: "add",
        smartEntry: { used: true },
        receipt: { accessKey: "synthetic" },
      }),
    });
    assert.equal((await router(req, new URL(req.url))).status, 200);
    assert.deepEqual(
      [learning, telemetry, receipt],
      replayed ? [0, 0, 0] : [1, 1, 1],
    );
  }
});
