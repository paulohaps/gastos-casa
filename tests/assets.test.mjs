import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("todos os scripts locais do HTML estão disponíveis no cache offline da mesma versão", () => {
  const html = fs.readFileSync("index.html", "utf8"),
    sw = fs.readFileSync("sw.js", "utf8");
  for (const [, src] of html.matchAll(/<script src="(js\/[^\"]+)"/g)) {
    assert.equal(fs.existsSync(src.split("?")[0]), true, src);
    assert.equal(sw.includes(`'./${src}'`), true, `Precache ausente: ${src}`);
  }
});
