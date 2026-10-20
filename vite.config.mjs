import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

let outputDirectory = "dist";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "financial-legacy-boundary",
      configResolved(config) {
        outputDirectory = config.build.outDir;
      },
      closeBundle() {
        // Publish only browser assets; never backend, SQL, docs, tests or credentials.
        for (const name of ["js", "css", "icons", "manifest.json"]) {
          if (fs.existsSync(name))
            fs.cpSync(name, path.join(outputDirectory, name), {
              recursive: true,
            });
        }
        fs.mkdirSync(path.join(outputDirectory, "fonts"), { recursive: true });
        fs.copyFileSync(
          "fonts/Inter-LICENSE.txt",
          path.join(outputDirectory, "fonts/Inter-LICENSE.txt"),
        );
        // Keep manifest-relative start_url at the app root, including nested PR paths.
        const indexPath = path.join(outputDirectory, "index.html");
        fs.writeFileSync(
          indexPath,
          fs
            .readFileSync(indexPath, "utf8")
            .replace(
              /href="\.\/assets\/manifest-[^"]+\.json"/,
              'href="./manifest.json"',
            ),
        );
        for (const file of fs.readdirSync(path.join(outputDirectory, "assets")))
          if (/^manifest-.*\.json$/.test(file))
            fs.unlinkSync(
              path.join(path.join(outputDirectory, "assets"), file),
            );
        const apiPath = path.join(outputDirectory, "js/api.js");
        if (process.env.PREVIEW_BACKEND_URL) {
          const production =
            "https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech";
          const preview = new URL(process.env.PREVIEW_BACKEND_URL);
          if (preview.protocol !== "https:" || preview.origin === production)
            throw new Error("Preview must use an isolated HTTPS backend.");
          const source = fs.readFileSync(apiPath, "utf8");
          if (!source.includes(production))
            throw new Error("Backend configuration missing.");
          const namespace =
            "gastos_pwa_preview_" +
            createHash("sha256")
              .update(preview.origin)
              .digest("hex")
              .slice(0, 12);
          fs.writeFileSync(
            apiPath,
            source
              .replace(production, preview.origin)
              .replace(
                "'gastos_pwa_session_token_v2'",
                JSON.stringify(namespace + "_session_token_v2"),
              )
              .replace(
                "'gastos_pwa_session_user_v2'",
                JSON.stringify(namespace + "_session_user_v2"),
              ),
          );

          const appPath = path.join(outputDirectory, "js/app.js");
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
        const files = walk(outputDirectory).sort();
        const hash = createHash("sha256");
        files.forEach((file) =>
          hash
            .update(path.relative(outputDirectory, file))
            .update(fs.readFileSync(file)),
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
            ...files.map(
              (file) =>
                "./" +
                path.relative(outputDirectory, file).split(path.sep).join("/"),
            ),
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
        fs.writeFileSync(path.join(outputDirectory, "sw.js"), sw);
      },
    },
  ],
  build: { target: "es2022", sourcemap: false },
});
