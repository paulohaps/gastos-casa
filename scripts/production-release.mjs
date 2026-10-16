import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const preserved = new Set([".git", "pr-preview", "releases"]);
const allowedBuild = new Set([
  "assets",
  "css",
  "fonts",
  "icons",
  "js",
  "index.html",
  "manifest.json",
  "sw.js",
  ".nojekyll",
]);
function releaseId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(value || "") || value.includes(".."))
    throw new Error("Invalid release ID.");
  return value;
}
function assertRoot(root) {
  if (!fs.existsSync(path.join(root, ".git")))
    throw new Error(
      "Target must be a separate Git checkout of the Pages branch.",
    );
}
function files(directory, prefix = "") {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      if (!prefix && preserved.has(entry.name)) return [];
      const relative = path.join(prefix, entry.name);
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Symlinks are not valid release assets.");
      if (entry.isDirectory()) return files(full, relative);
      if (!entry.isFile())
        throw new Error("Release contains a non-regular file.");
      return [relative];
    });
}
function digest(directory) {
  const hash = createHash("sha256");
  for (const file of files(directory).filter(
    (file) => file !== "release.json",
  )) {
    hash
      .update(file)
      .update("\0")
      .update(fs.readFileSync(path.join(directory, file)))
      .update("\0");
  }
  return hash.digest("hex");
}
function copy(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of files(source)) {
    const destination = path.join(target, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(source, file), destination);
  }
}
function metadata(directory) {
  return JSON.parse(
    fs.readFileSync(path.join(directory, "release.json"), "utf8"),
  );
}
function readArchive(file, expectedId) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = value.metadata;
  if (
    !data ||
    data.release_id !== releaseId(expectedId || data.release_id) ||
    !value.files ||
    Array.isArray(value.files)
  )
    throw new Error("Invalid release archive.");
  const entries = Object.entries(value.files).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const hash = createHash("sha256");
  const decoded = entries.map(([name, encoded]) => {
    if (
      !name ||
      name.includes("\\") ||
      path.posix.isAbsolute(name) ||
      name.split("/").some((part) => !part || part === "." || part === "..") ||
      preserved.has(name.split("/")[0]) ||
      name === "release.json"
    )
      throw new Error("Invalid archive path.");
    if (typeof encoded !== "string")
      throw new Error("Invalid archive encoding.");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded)
      throw new Error("Invalid archive encoding.");
    hash.update(name).update("\0").update(bytes).update("\0");
    return [name, bytes];
  });
  for (const name of ["index.html", "sw.js", "js/api.js"])
    if (!Object.hasOwn(value.files, name))
      throw new Error("Incomplete release.");
  if (hash.digest("hex") !== data.content_sha256)
    throw new Error("Release checksum mismatch.");
  return { metadata: data, files: decoded };
}
function validateArchive(directory, id) {
  if (fs.statSync(directory).isFile())
    return readArchive(directory, id).metadata;
  const data = metadata(directory);
  if (
    data.release_id !== releaseId(id) ||
    data.content_sha256 !== digest(directory)
  )
    throw new Error("Release checksum mismatch.");
  for (const required of ["index.html", "sw.js", "js/api.js"])
    if (!fs.existsSync(path.join(directory, required)))
      throw new Error("Incomplete release.");
  return data;
}
function archive(root, source, data) {
  const target = path.join(
    root,
    "releases",
    releaseId(data.release_id) + ".json",
  );
  if (fs.existsSync(target)) {
    const existing = validateArchive(target, data.release_id);
    if (
      existing.content_sha256 !== digest(source) ||
      existing.source_sha !== data.source_sha
    )
      throw new Error("An immutable release cannot be replaced.");
    return target;
  }
  const value = {
    metadata: { ...data, content_sha256: digest(source) },
    files: Object.fromEntries(
      files(source)
        .filter((file) => file !== "release.json")
        .map((file) => [
          file,
          fs.readFileSync(path.join(source, file)).toString("base64"),
        ]),
    ),
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + ".tmp";
  try {
    fs.writeFileSync(temporary, JSON.stringify(value) + "\n", { flag: "wx" });
    validateArchive(temporary, data.release_id);
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return target;
}
function backupCurrent(root) {
  if (!fs.existsSync(path.join(root, "index.html")))
    throw new Error(
      "Current production is missing; refusing to publish without a backup.",
    );
  if (fs.existsSync(path.join(root, "release.json"))) {
    const data = metadata(root);
    validateArchive(root, data.release_id);
    archive(root, root, data);
    return data.release_id;
  }
  const id = "legacy-" + digest(root).slice(0, 16);
  archive(root, root, {
    release_id: id,
    source_sha: null,
    created_at: new Date().toISOString(),
    kind: "legacy-backup",
  });
  return id;
}
function replaceRoot(root, source) {
  // Validate every file before removing the current root. JSON archives cannot
  // run an old app or register a second service worker under /releases/.
  const selected = readArchive(source);
  for (const entry of fs.readdirSync(root)) {
    if (!preserved.has(entry))
      fs.rmSync(path.join(root, entry), { recursive: true, force: true });
  }
  for (const [name, bytes] of selected.files) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  fs.writeFileSync(
    path.join(root, "release.json"),
    JSON.stringify(selected.metadata, null, 2) + "\n",
  );
}
export function publishRelease({ root, source, release, sourceSha }) {
  releaseId(release);
  if (!/^[a-f0-9]{40}$/.test(sourceSha || ""))
    throw new Error("Source must be an exact Git commit.");
  root = path.resolve(root);
  source = path.resolve(source);
  assertRoot(root);
  if (source === root || source.startsWith(root + path.sep))
    throw new Error("Build must be outside the Pages checkout.");
  for (const name of fs.readdirSync(source))
    if (!allowedBuild.has(name))
      throw new Error("Unexpected build file: " + name);
  if (
    !fs
      .readFileSync(path.join(source, "js/api.js"), "utf8")
      .includes(
        "const GASTOS_BACKEND_URL = 'https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech'",
      )
  )
    throw new Error("Build does not point at the production backend.");
  files(source);
  if (fs.existsSync(path.join(root, "release.json"))) {
    const active = validateArchive(root, metadata(root).release_id);
    if (active.release_id === release) {
      if (active.source_sha !== sourceSha)
        throw new Error("Active release points at another commit.");
      return { release, previous: release, changed: false };
    }
  }
  const previous = backupCurrent(root);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gastos-publish-"));
  try {
    copy(source, temporary);
    // Retain hashed assets for already-open pages during a release transition.
    const assets = path.join(root, "assets");
    if (fs.existsSync(assets))
      for (const file of files(assets)) {
        const destination = path.join(temporary, "assets", file);
        if (fs.existsSync(destination)) {
          if (
            !fs
              .readFileSync(destination)
              .equals(fs.readFileSync(path.join(assets, file)))
          )
            throw new Error("Hashed asset collision.");
        } else {
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.copyFileSync(path.join(assets, file), destination);
        }
      }
    if (fs.existsSync(path.join(root, "CNAME")))
      fs.copyFileSync(path.join(root, "CNAME"), path.join(temporary, "CNAME"));
    fs.writeFileSync(path.join(temporary, ".nojekyll"), "");
    const target = archive(root, temporary, {
      release_id: release,
      source_sha: sourceSha,
      previous_release: previous,
      created_at: new Date().toISOString(),
      kind: "production",
    });
    replaceRoot(root, target);
    validateArchive(root, release);
    return { release, previous, changed: true };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
export function rollbackRelease({ root, release }) {
  releaseId(release);
  root = path.resolve(root);
  assertRoot(root);
  const target = path.join(root, "releases", release + ".json");
  validateArchive(target, release);
  const previous = backupCurrent(root);
  replaceRoot(root, target);
  validateArchive(root, release);
  return { release, previous, changed: previous !== release };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...value] = arg.replace(/^--/, "").split("=");
      return [key, value.join("=")];
    }),
  );
  try {
    const result =
      args.mode === "rollback"
        ? rollbackRelease(args)
        : args.mode === "publish"
          ? publishRelease(args)
          : (() => {
              throw new Error("Use --mode=publish or --mode=rollback.");
            })();
    console.log(JSON.stringify(result));
    if (process.env.GITHUB_OUTPUT)
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `release=${result.release}\nprevious=${result.previous}\nchanged=${result.changed}\n`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
