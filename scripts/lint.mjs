import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import postcss from "postcss";

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}
const scripts = [
  ...files("js"),
  ...files("backend"),
  ...files("scripts"),
  ...files("tests"),
  "sw.js",
  "playwright.config.mjs",
  "vite.config.mjs",
].filter((name) => /\.(m?js)$/.test(name));
for (const name of scripts) execFileSync(process.execPath, ["--check", name]);
for (const stylesheet of files("css").filter((name) => name.endsWith(".css"))) {
  const css = postcss.parse(fs.readFileSync(stylesheet, "utf8"), {
    from: stylesheet,
  });
  css.walkRules((rule) => {
    const properties = new Set();
    rule.walkDecls((decl) => {
      if (properties.has(decl.prop))
        throw decl.error(`Propriedade repetida: ${decl.prop}`);
      properties.add(decl.prop);
    });
  });
}
execFileSync(process.execPath, ["scripts/check-frontend.mjs"], {
  stdio: "inherit",
});
console.log(
  `Lint: sintaxe de ${scripts.length} arquivos e CSS sem declarações duplicadas.`,
);
