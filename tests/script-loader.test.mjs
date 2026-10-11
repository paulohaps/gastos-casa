import test from "node:test";
import assert from "node:assert/strict";
import "../js/core/script-loader.js";
function setup(timeout) {
  const scripts = [],
    globals = {};
  const document = {
    createElement: () => ({
      remove() {
        scripts.splice(scripts.indexOf(this), 1);
      },
    }),
    head: { appendChild: (script) => scripts.push(script) },
  };
  return {
    scripts,
    globals,
    loader: globalThis.GastosScriptLoader.create(document, globals, timeout),
  };
}
for (const name of ["jsQR", "Tesseract"])
  test(`${name}: CDN rejeitada permite tentar novamente e deduplica chamadas`, async () => {
    const { scripts, globals, loader } = setup();
    const first = loader.load("https://cdn/test.js", name);
    assert.equal(loader.load("https://cdn/test.js", name), first);
    scripts[0].onerror();
    await assert.rejects(first, /Tente novamente/);
    assert.equal(scripts.length, 0);
    const retry = loader.load("https://cdn/test.js", name);
    globals[name] = { ready: true };
    scripts[0].onload();
    assert.equal(await retry, globals[name]);
    assert.equal(await loader.load("https://cdn/test.js", name), globals[name]);
    assert.equal(scripts.length, 1);
  });
test("script carregado sem global é removido e não bloqueia nova tentativa", async () => {
  const { scripts, globals, loader } = setup();
  const first = loader.load("/invalid.js", "jsQR");
  scripts[0].onload();
  await assert.rejects(first);
  assert.equal(scripts.length, 0);
  const retry = loader.load("/valid.js", "jsQR");
  globals.jsQR = () => {};
  scripts[0].onload();
  assert.equal(await retry, globals.jsQR);
});
test("CDN sem resposta expira e libera cache", async () => {
  const { scripts, loader } = setup(5);
  await assert.rejects(loader.load("/timeout.js", "jsQR"), /demorou/);
  assert.equal(scripts.length, 0);
  const retry = loader.load("/timeout.js", "jsQR");
  scripts[0].onerror();
  await assert.rejects(retry, /Falha/);
});
