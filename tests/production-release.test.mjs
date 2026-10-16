import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  publishRelease,
  rollbackRelease,
} from "../scripts/production-release.mjs";
const sha = "a".repeat(40);
function write(root, name, content) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), content);
}
function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "gastos-release-test-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, "pages"),
    source = path.join(directory, "build");
  fs.mkdirSync(root);
  fs.mkdirSync(source);
  write(root, ".git", "checkout");
  write(root, "index.html", "old-ui");
  write(root, "sw.js", "const CACHE_NAME='old';");
  write(root, "js/api.js", "old-api");
  write(root, "pr-preview/pr-16/index.html", "preview");
  write(root, "assets/old-hash.js", "old-cached-page");
  write(source, "index.html", "premium-ui");
  write(source, "sw.js", "const CACHE_NAME='premium';");
  write(
    source,
    "js/api.js",
    "const GASTOS_BACKEND_URL = 'https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech';",
  );
  write(source, "assets/new-hash.js", "new-ui-code");
  return { root, source, sourceSha: sha, release: "prod-test-a" };
}
test("publish archives production and rollback restores exact files without deleting previews or versions", (t) => {
  const options = fixture(t),
    first = publishRelease(options);
  assert.equal(
    fs.readFileSync(path.join(options.root, "index.html"), "utf8"),
    "premium-ui",
  );
  assert.equal(
    fs.readFileSync(path.join(options.root, "assets/old-hash.js"), "utf8"),
    "old-cached-page",
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.root, "releases", first.previous, "index.html"),
      "utf8",
    ),
    "old-ui",
  );
  rollbackRelease({ root: options.root, release: first.previous });
  assert.equal(
    fs.readFileSync(path.join(options.root, "index.html"), "utf8"),
    "old-ui",
  );
  assert.equal(
    fs.readFileSync(path.join(options.root, "sw.js"), "utf8"),
    "const CACHE_NAME='old';",
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.root, "pr-preview/pr-16/index.html"),
      "utf8",
    ),
    "preview",
  );
  assert.equal(
    fs.existsSync(path.join(options.root, "releases/prod-test-a/index.html")),
    true,
  );
  rollbackRelease({ root: options.root, release: "prod-test-a" });
  assert.equal(
    fs.readFileSync(path.join(options.root, "sw.js"), "utf8"),
    "const CACHE_NAME='premium';",
  );
});
test("corrupt or missing rollback release leaves current production intact", (t) => {
  const options = fixture(t);
  publishRelease(options);
  write(options.root, "releases/prod-test-a/index.html", "tampered");
  assert.throws(
    () => rollbackRelease({ root: options.root, release: "prod-test-a" }),
    /checksum/,
  );
  assert.throws(() =>
    rollbackRelease({ root: options.root, release: "missing" }),
  );
  assert.equal(
    fs.readFileSync(path.join(options.root, "index.html"), "utf8"),
    "premium-ui",
  );
});
test("release IDs and checkout guard reject traversal or accidental directory replacement", (t) => {
  const options = fixture(t);
  for (const release of [
    "../main",
    "release/../../x",
    "",
    "UPPER",
    "prod\nother",
  ])
    assert.throws(
      () => publishRelease({ ...options, release }),
      /Invalid release/,
    );
  fs.unlinkSync(path.join(options.root, ".git"));
  assert.throws(() => publishRelease(options), /Git checkout/);
  assert.equal(
    fs.readFileSync(path.join(options.root, "index.html"), "utf8"),
    "old-ui",
  );
});
test("preview backend, private files and symlinks cannot enter a production release", (t) => {
  const options = fixture(t),
    api = fs.readFileSync(path.join(options.source, "js/api.js"), "utf8");
  write(
    options.source,
    "js/api.js",
    api.replace("br-polished-voice-a5flam43", "br-preview"),
  );
  assert.throws(() => publishRelease(options), /production backend/);
  write(options.source, "js/api.js", api);
  write(options.source, ".env", "private");
  assert.throws(() => publishRelease(options), /Unexpected build file/);
  fs.unlinkSync(path.join(options.source, ".env"));
  fs.symlinkSync(
    path.join(options.root, "index.html"),
    path.join(options.source, "assets/symlink.js"),
  );
  assert.throws(() => publishRelease(options), /Symlinks/);
  assert.equal(
    fs.readFileSync(path.join(options.root, "index.html"), "utf8"),
    "old-ui",
  );
});
test("retry keeps immutable release bytes and rejects reuse for another commit", (t) => {
  const options = fixture(t);
  publishRelease(options);
  const before = fs.readFileSync(
    path.join(options.root, "release.json"),
    "utf8",
  );
  assert.equal(publishRelease(options).changed, false);
  assert.equal(
    fs.readFileSync(path.join(options.root, "release.json"), "utf8"),
    before,
  );
  assert.throws(
    () => publishRelease({ ...options, sourceSha: "b".repeat(40) }),
    /another commit/,
  );
});
test("successive releases preserve hostname, cached assets and restoration in both directions", (t) => {
  const options = fixture(t);
  write(options.root, "CNAME", "finance.example.com");
  publishRelease(options);
  write(options.source, "index.html", "second-ui");
  write(options.source, "assets/second-hash.js", "second-code");
  publishRelease({
    ...options,
    release: "prod-test-b",
    sourceSha: "b".repeat(40),
  });
  assert.equal(
    fs.readFileSync(path.join(options.root, "CNAME"), "utf8"),
    "finance.example.com",
  );
  assert.equal(
    fs.readFileSync(path.join(options.root, "assets/old-hash.js"), "utf8"),
    "old-cached-page",
  );
  rollbackRelease({ root: options.root, release: "prod-test-a" });
  assert.equal(
    fs.readFileSync(path.join(options.root, "index.html"), "utf8"),
    "premium-ui",
  );
  rollbackRelease({ root: options.root, release: "prod-test-b" });
  assert.equal(
    fs.readFileSync(path.join(options.root, "index.html"), "utf8"),
    "second-ui",
  );
});
