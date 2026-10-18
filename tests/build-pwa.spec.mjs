import { test, expect } from "@playwright/test";
import fs from "node:fs";
import vm from "node:vm";
import { mockBackend } from "./helpers/mock-backend.mjs";

test("build relativo publica só assets do navegador e o manifest inicia no diretório do aplicativo", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/index.html#assistente");
  const manifestPath = await page
    .locator("link[rel=manifest]")
    .getAttribute("href");
  expect(manifestPath).toBe("./manifest.json");
  const manifest = await (await page.request.get(manifestPath)).json();
  expect(
    new URL(
      manifest.start_url,
      "https://host.test/pr-preview/pr-16/manifest.json",
    ).pathname,
  ).toBe("/pr-preview/pr-16/index.html");
  expect(fs.existsSync("dist/backend")).toBe(false);
  expect(fs.existsSync("dist/db")).toBe(false);
  expect(fs.existsSync("dist/src")).toBe(false);
  const precache = vm.runInNewContext(
    fs
      .readFileSync("dist/sw.js", "utf8")
      .split("self.addEventListener('install'")[0] + "; PRECACHE",
  );
  expect(precache.some((file) => /assets\/index-.*\.js$/.test(file))).toBe(
    true,
  );
  expect(precache.some((file) => /assets\/index-.*\.css$/.test(file))).toBe(
    true,
  );
  for (const file of precache.filter((file) => file !== "./"))
    expect(fs.existsSync("dist/" + file.slice(2).split("?")[0])).toBe(true);
});

test("PWA instala o bundle React e reabre sua interface offline sem armazenar respostas da API", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  try {
    await mockBackend(page);
    await page.goto("/index.html#assistente");
    await expect(page.locator("#assistantComposer")).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
    });
    const urls = await page.evaluate(async () => {
      const keys = await caches.keys();
      const result = [];
      for (const key of keys) {
        if (key.startsWith("gastos-"))
          result.push(
            ...(await (await caches.open(key)).keys()).map(
              (request) => request.url,
            ),
          );
      }
      return result;
    });
    expect(urls.some((url) => /assets\/index-.*\.js$/.test(url))).toBe(true);
    expect(
      urls.every((url) => new URL(url).origin === "http://127.0.0.1:4173"),
    ).toBe(true);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#assistantTitle")).toHaveText("Assistente");
    await expect(page.locator("#assistantComposer")).toBeVisible();
    expect(
      await page
        .locator(".composer-send")
        .evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe("rgb(165, 197, 255)");
  } finally {
    await context.close();
  }
});
