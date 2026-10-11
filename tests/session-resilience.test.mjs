import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
function setup(status, code) {
  const storage = new Map([["gastos_pwa_session_token_v2", "token"]]);
  const context = vm.createContext({
    console: { warn() {} },
    Headers,
    queueMicrotask,
    localStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
    window: {
      GastosHttp: {
        requestJson: async () => {
          const e = new Error("falha");
          e.status = status;
          e.code = code;
          throw e;
        },
      },
    },
    document: { readyState: "loading", addEventListener() {} },
  });
  vm.runInContext(fs.readFileSync("js/api.js", "utf8"), context);
  return { storage, restore: vm.runInContext("recuperarSessaoSalva", context) };
}
for (const [status, code] of [
  [503, "BACKEND_ERROR"],
  [undefined, "NETWORK_ERROR"],
  [undefined, "REQUEST_TIMEOUT"],
])
  test("falha temporária preserva token: " + code, async () => {
    const { storage, restore } = setup(status, code);
    await assert.rejects(restore());
    assert.equal(storage.get("gastos_pwa_session_token_v2"), "token");
  });
for (const status of [401, 403])
  test("sessão inválida é removida: " + status, async () => {
    const { storage, restore } = setup(status);
    assert.equal(await restore(), null);
    assert.equal(storage.has("gastos_pwa_session_token_v2"), false);
  });
