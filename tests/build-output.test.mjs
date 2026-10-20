import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
test("build de prévia respeita outDir e isola sessão sem modificar saída padrão", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "gastos-build-"));
  let previous;
  try {
    previous = await readFile("dist/js/api.js");
  } catch {}
  const preview = "https://isolated-preview.example.invalid";
  try {
    execFileSync(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "build", "--outDir", output],
      { env: { ...process.env, PREVIEW_BACKEND_URL: preview }, stdio: "pipe" },
    );
    const api = await readFile(path.join(output, "js/api.js"), "utf8");
    assert.ok(api.includes(preview));
    assert.ok(
      api.includes(
        "gastos_pwa_preview_" +
          createHash("sha256").update(preview).digest("hex").slice(0, 12),
      ),
    );
    assert.ok(!api.includes("'gastos_pwa_session_token_v2'"));
    const html = await readFile(path.join(output, "index.html"), "utf8");
    assert.ok(html.includes('href="./manifest.json"'));
    assert.ok(html.includes('class="preview-notice"'));
    assert.ok(html.includes('content="noindex,nofollow"'));
    const sw = await readFile(path.join(output, "sw.js"), "utf8");
    assert.ok(sw.includes("./js/api.js"));
    assert.ok(!sw.includes(output));
    for (const ref of [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((m) => m[1])
      .filter((v) => !/^https?:|^data:|^\//.test(v)))
      await access(path.join(output, ref.split("?")[0]));
    if (previous) assert.deepEqual(await readFile("dist/js/api.js"), previous);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
