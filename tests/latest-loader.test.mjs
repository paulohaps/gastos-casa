import test from "node:test";
import assert from "node:assert/strict";
import "../js/core/latest-loader.js";
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
test("nova seleção aborta a anterior e ignora resposta fora de ordem", async () => {
  const requests = [],
    states = [];
  const loader = globalThis.GastosLatestLoader.create({
    read: (key, signal) => {
      const task = deferred();
      requests.push({ ...task, signal });
      return task.promise;
    },
    publish: (s) => states.push(s),
    isEmpty: (data) => !data.length,
  });
  const old = loader.load("09/2026"),
    current = loader.load("08/2026");
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve([80]);
  await current;
  requests[0].resolve([900]);
  await old;
  assert.deepEqual(states.at(-1), {
    status: "success",
    key: "08/2026",
    data: [80],
  });
  assert.equal(states.filter((s) => s.status === "success").length, 1);
});
test("loading, empty e error não conservam os dados do mês anterior", async () => {
  const states = [];
  let fail = false;
  const loader = globalThis.GastosLatestLoader.create({
    read: async () => {
      if (fail) throw new Error("503");
      return [];
    },
    publish: (s) => states.push(s),
    isEmpty: (data) => !data.length,
  });
  await loader.load("08/2026");
  fail = true;
  await loader.load("09/2026");
  assert.deepEqual(
    states.map((s) => s.status),
    ["loading", "empty", "loading", "error"],
  );
  assert.equal(states.at(-1).data, null);
  assert.equal(states.at(-1).key, "09/2026");
});
test("erro de uma consulta cancelada não substitui sucesso atual", async () => {
  const old = deferred(),
    states = [];
  const loader = globalThis.GastosLatestLoader.create({
    read: (key) => (key === "old" ? old.promise : Promise.resolve([1])),
    publish: (s) => states.push(s),
    isEmpty: () => false,
  });
  const first = loader.load("old");
  await loader.load("new");
  old.reject(new Error("rede antiga"));
  await first;
  assert.equal(states.at(-1).status, "success");
  assert.equal(states.at(-1).key, "new");
});
