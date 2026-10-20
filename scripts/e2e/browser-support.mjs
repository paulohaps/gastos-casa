import { readFile } from "node:fs/promises";
import { expect as baseExpect } from "@playwright/test";
import { state } from "./client.mjs";
const expect = baseExpect.configure({ timeout: 30000 });
export const reportRoot =
  process.env.GASTOS_PREVIEW_REPORT_DIR ||
  "/workspace/artifacts/integrated-20261020";
export const siteUrl =
  process.env.GASTOS_PREVIEW_SITE_URL ||
  "https://paulohaps.github.io/gastos-casa/pr-preview/native-e2e/index.html";
export const browserProxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" }
  : undefined;
export async function staticPreview(context) {
  if (!siteUrl.includes("/pr-preview/native-e2e/")) return;
  const prefix = "/gastos-casa/pr-preview/native-e2e/";
  const types = {
    js: "application/javascript",
    mjs: "application/javascript",
    css: "text/css",
    html: "text/html",
    json: "application/json",
    woff2: "font/woff2",
    svg: "image/svg+xml",
    png: "image/png",
    ico: "image/x-icon",
  };
  await context.route(
    "https://paulohaps.github.io" + prefix + "**",
    async (route) => {
      const file =
        decodeURIComponent(
          new URL(route.request().url()).pathname.slice(prefix.length),
        ) || "index.html";
      if (file.includes("..")) return route.abort();
      try {
        const body = await readFile(reportRoot + "/site/" + file);
        return route.fulfill({
          status: 200,
          body,
          contentType:
            types[file.split(".").pop()] || "application/octet-stream",
        });
      } catch {
        return route.fulfill({ status: 404, body: "Build asset missing" });
      }
    },
  );
  await context.addInitScript(() =>
    localStorage.setItem(
      "gastos_pwa_session_token_v2",
      "production-session-must-remain",
    ),
  );
}
export async function login(page, label) {
  const a = state.accounts.find((a) => a.label === label);
  await page.goto(siteUrl, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#authForm")).toBeVisible();
  await page.locator("#authEmail").fill(a.email);
  await page.locator("#authSenha").fill(a.password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#authDialog")).not.toBeVisible();
  await page.locator("#seletorMes").selectOption(state.fixture.month);
  await expect(page.locator("#homeHouseTotal")).toContainText("360,00");
}
export async function nav(page, view) {
  await page.locator(`nav [data-app-nav="${view}"]:visible`).first().click();
  await expect(page.locator("body")).toHaveAttribute("data-app-view", view);
}
