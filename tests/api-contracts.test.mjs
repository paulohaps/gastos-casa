import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import "../js/core/api-contracts.js";
const { arrayField, user } = globalThis.GastosApiContracts;
test("listas ausentes, nulas e objetos não são tratados como mês vazio", () => {
  for (const key of [
    "expenses",
    "settlements",
    "budgets",
    "recurring",
    "wallets",
    "members",
    "rules",
    "months",
  ]) {
    for (const data of [
      null,
      {},
      { [key]: null },
      { [key]: {} },
      { [key]: "erro" },
    ])
      assert.throws(() => arrayField(data, key), { code: "INVALID_RESPONSE" });
    assert.deepEqual(arrayField({ [key]: [] }, key), []);
  }
});
const expense = {
  id: 1,
  data: "2026-09-20",
  valor: "19.90",
  descricao: "Mercado",
  categoria: "Mercado",
  usuario: "Paulo",
  forma_pagamento: "Dinheiro",
};
test("contrato de gastos aceita decimal do banco e rejeita dados que quebram cálculos", () => {
  assert.equal(
    arrayField({ expenses: [expense] }, "expenses", "householdExpenses")[0],
    expense,
  );
  for (const invalid of [
    null,
    {},
    { ...expense, valor: "NaN" },
    { ...expense, valor: Infinity },
    { ...expense, valor: "" },
    { ...expense, valor: -1 },
    { ...expense, data: "2026-02-30" },
    { ...expense, descricao: [] },
    { ...expense, usuario: null },
  ])
    assert.throws(
      () =>
        arrayField({ expenses: [invalid] }, "expenses", "householdExpenses"),
      { code: "INVALID_RESPONSE" },
    );
});
test("limites, recorrências e períodos são validados na fronteira", () => {
  assert.throws(
    () =>
      arrayField(
        { budgets: [{ categoria: "Mercado", valor_limite: "ruim" }] },
        "budgets",
      ),
    { code: "INVALID_RESPONSE" },
  );
  assert.throws(
    () =>
      arrayField(
        { wallets: [{ id: 1, nome: "Pessoal", limite_mensal: Infinity }] },
        "wallets",
      ),
    { code: "INVALID_RESPONSE" },
  );
  assert.throws(
    () =>
      arrayField(
        {
          recurring: [
            {
              id: 1,
              descricao: "Conta",
              valor: 10,
              categoria: "Contas",
              forma_pagamento: "Dinheiro",
              dia_vencimento: 32,
              ativo: true,
            },
          ],
        },
        "recurring",
      ),
    { code: "INVALID_RESPONSE" },
  );
  assert.throws(() => arrayField({ months: ["13/2026"] }, "months"), {
    code: "INVALID_RESPONSE",
  });
});
test("sessão exige nome e e-mail antes de atualizar usuário", () => {
  assert.equal(
    user({ name: "Paulo", email: "paulo@example.com" }).name,
    "Paulo",
  );
  for (const value of [null, [], {}, { name: [], email: "paulo@example.com" }])
    assert.throws(() => user(value), { code: "INVALID_RESPONSE" });
});

test("cliente rejeita listas inválidas em todos os módulos antes de renderizar", async () => {
  const context = vm.createContext({
    Headers,
    console,
    window: {
      GastosApiContracts: globalThis.GastosApiContracts,
      GastosHttp: {
        requestJson: async () => ({
          expenses: {},
          budgets: {},
          settlements: {},
          members: {},
          wallets: {},
          recurring: {},
          rules: {},
          months: {},
        }),
      },
    },
    localStorage: { getItem: () => "token", setItem() {} },
    document: { readyState: "loading", addEventListener() {} },
  });
  vm.runInContext(fs.readFileSync("js/api.js", "utf8"), context);
  vm.runInContext(
    'authReadyPromise=Promise.resolve({user:{name:"Paulo",email:"paulo@example.com"}})',
    context,
  );
  const api = vm.runInContext("api", context);
  for (const [method, args] of [
    ["fetchGastosPorMes", ["09/2026"]],
    ["fetchAcertos", ["09/2026"]],
    ["fetchOrcamentos", ["09/2026"]],
    ["fetchWallets", []],
    ["fetchWalletExpenses", ["id", "2026-09"]],
    ["fetchRecorrentes", []],
    ["fetchSmartRules", []],
    ["fetchMembros", []],
    ["fetchMeses", []],
  ])
    await assert.rejects(
      api[method](...args),
      { code: "INVALID_RESPONSE" },
      method,
    );
});

test("envelope inválido não substitui token local por objeto", async () => {
  let token = "original";
  const context = vm.createContext({
    Headers,
    console,
    window: {
      GastosApiContracts: globalThis.GastosApiContracts,
      GastosHttp: { requestJson: async () => ({ token: { invalid: true } }) },
    },
    localStorage: {
      getItem: () => token,
      setItem: (_, value) => {
        token = value;
      },
    },
    document: { readyState: "loading", addEventListener() {} },
  });
  vm.runInContext(fs.readFileSync("js/api.js", "utf8"), context);
  await assert.rejects(vm.runInContext('backendFetch("/expenses")', context), {
    code: "INVALID_RESPONSE",
  });
  assert.equal(token, "original");
});
