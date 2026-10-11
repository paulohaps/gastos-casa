import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "financial-legacy-boundary",
      closeBundle() {
        // Publish only browser assets; never backend, SQL, docs, tests or credentials.
        for (const name of ["js", "css", "icons", "manifest.json"]) {
          if (fs.existsSync(name))
            fs.cpSync(name, path.join("dist", name), { recursive: true });
        }
        // Keep manifest-relative start_url at the app root, including nested PR paths.
        const indexPath = "dist/index.html";
        fs.writeFileSync(
          indexPath,
          fs
            .readFileSync(indexPath, "utf8")
            .replace(
              /href="\.\/assets\/manifest-[^"]+\.json"/,
              'href="./manifest.json"',
            ),
        );
        for (const file of fs.readdirSync("dist/assets"))
          if (/^manifest-.*\.json$/.test(file))
            fs.unlinkSync(path.join("dist/assets", file));
        const apiPath = "dist/js/api.js";
        if (process.env.PREVIEW_BACKEND_URL) {
          const production =
            "https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech";
          const preview = new URL(process.env.PREVIEW_BACKEND_URL);
          if (preview.protocol !== "https:" || preview.origin === production)
            throw new Error("Preview must use an isolated HTTPS backend.");
          const source = fs.readFileSync(apiPath, "utf8");
          if (!source.includes(production))
            throw new Error("Backend configuration missing.");
          fs.writeFileSync(apiPath, source.replace(production, preview.origin));
          const appPath = "dist/js/app.js";
          fs.writeFileSync(
            appPath,
            fs
              .readFileSync(appPath, "utf8")
              .replace(
                "if ('serviceWorker' in navigator) {",
                "if (false && 'serviceWorker' in navigator) {",
              ),
          );
        }
        const walk = (directory) =>
          fs
            .readdirSync(directory, { withFileTypes: true })
            .flatMap((entry) =>
              entry.isDirectory()
                ? walk(path.join(directory, entry.name))
                : [path.join(directory, entry.name)],
            );
        const files = walk("dist").sort();
        const hash = createHash("sha256");
        files.forEach((file) =>
          hash.update(file).update(fs.readFileSync(file)),
        );
        const version = hash.digest("hex").slice(0, 12);
        const references = [
          ...fs
            .readFileSync(indexPath, "utf8")
            .matchAll(/(?:src|href)="([^"#]+)"/g),
        ]
          .map((match) => match[1])
          .filter((url) => !/^(https?:|data:|\/)/.test(url))
          .map((url) => (url.startsWith("./") ? url : "./" + url));
        const precache = [
          ...new Set([
            "./",
            ...files.map((file) => "./" + file.slice(5)),
            ...references,
          ]),
        ];
        let sw = fs.readFileSync("sw.js", "utf8");
        sw = sw.replace(
          /const CACHE_NAME = .*?;/,
          `const CACHE_NAME = 'gastos-build-${version}';`,
        );
        sw = sw.replace(
          /const PRECACHE = \[[\s\S]*?\];/,
          "const PRECACHE = " + JSON.stringify(precache) + ";",
        );
        fs.writeFileSync("dist/sw.js", sw);
      },
    },
  ],
  build: { target: "es2022", sourcemap: false },
});
