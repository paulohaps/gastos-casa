import { chromium, webkit, expect as baseExpect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { state } from "./client.mjs";
import {
  staticPreview,
  login,
  nav,
  browserProxy,
  reportRoot,
} from "./browser-support.mjs";
const expect = baseExpect.configure({ timeout: 30000 }),
  checks = [];
for (const [engine, widths] of [
  [chromium, [320, 768, 1440]],
  [webkit, [390, 768]],
]) {
  const browser = await engine.launch({
    ...(engine === chromium
      ? {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
        }
      : {}),
    proxy: browserProxy,
  });
  try {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: "pt-BR",
        timezoneId: "America/Porto_Velho",
        serviceWorkers: "block",
      });
      await staticPreview(context);
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await login(page, "ph");
      await expect(page.locator("#homePayable")).toContainText("35,00");
      await expect(page.locator("#homeReceivable")).toContainText("30,00");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const trigger = page.locator(".quick-expense-fab");
      if (width <= 900) {
        await expect(trigger).toHaveCount(1);
        expect((await trigger.boundingBox()).y).toBeLessThan(200);
      }
      if (width < 768) {
        await page
          .getByRole("button", { name: "Filtros", exact: true })
          .click();
        const dialog = page.locator("#dashboardFiltersDialog");
        await expect(dialog).toBeVisible();
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press("Tab");
          expect(
            await dialog.evaluate((d) => d.contains(document.activeElement)),
          ).toBe(true);
        }
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
      }
      await trigger.click();
      await expect(page.locator("#entryChoiceDialog")).toBeVisible();
      const rect = await page.locator("#entryChoiceDialog").boundingBox();
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(901);
      await page.locator("#entryChoiceClose").click();
      await expect(trigger).toBeFocused();
      await page.getByRole("tab", { name: "Análises", exact: true }).click();
      await expect(page.locator(".dashboard-trend")).toBeVisible();
      await page.getByRole("tab", { name: "Agora", exact: true }).click();
      let fail = true;
      await page.route(state.config.backendUrl + "/settlements?**", (route) =>
        fail
          ? route.fulfill({
              status: 503,
              json: { message: "Falha controlada de homologação" },
            })
          : route.continue(),
      );
      await page.evaluate(() => window.mudarMes());
      await expect(page.locator("#homePayable")).toHaveText("—");
      await expect(page.locator("#homeHouseTotal")).toContainText("360,00");
      fail = false;
      await page
        .getByRole("region", { name: "Disponibilidade dos acertos" })
        .getByRole("button", { name: "Tentar novamente" })
        .click();
      await expect(page.locator("#homePayable")).toContainText("35,00");
      await page.unroute(state.config.backendUrl + "/settlements?**");
      await nav(page, "assistente");
      await page.locator("#assistantMonth").fill(state.fixture.iso);
      await expect(page.locator("#assistantMessages")).toContainText(
        "provedor simulado",
      );
      await page
        .getByRole("link", { name: "Voltar ao Início", exact: true })
        .click();
      await expect(page.locator("#homeTitle")).toBeVisible();
      expect(errors).toEqual([]);
      await page.screenshot({
        path: reportRoot + `/native-${engine.name()}-${width}.png`,
        fullPage: true,
      });
      checks.push({
        engine: engine.name(),
        width,
        timezone: "America/Porto_Velho",
        nativeBackend: true,
        controlled503: true,
        passed: true,
      });
      console.log(
        `PASS: ${engine.name()} ${width}px native login, money, dialogs, graphs, retry and assistant exit`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  reportRoot + "/compatibility.json",
  JSON.stringify({ passed: true, checks, physicalIphone: false }, null, 2),
);
