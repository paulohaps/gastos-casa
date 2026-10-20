import { test, expect } from "@playwright/test";
import { mockBackend, BACKEND } from "./helpers/mock-backend.mjs";
for (const width of [320, 390])
  test(`abertura mobile tem uma ação principal e contexto nos filtros em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockBackend(page);
    await page.goto("/index.html");
    await expect(page.locator("#homeHouseTotal")).toContainText("366,40");
    await expect(page.locator(".workspace-switch")).toHaveCount(0);
    const action = page.locator(".quick-expense-fab");
    await expect(action).toHaveCount(1);
    expect((await action.boundingBox()).y).toBeLessThan(200);
    expect(
      (await page.locator("#homeHouseTotal").boundingBox()).y,
    ).toBeLessThan(350);
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    const panel = page.locator("#dashboardFiltersDialog");
    await expect(panel.getByLabel("Tipo de gasto")).toBeVisible();
    await panel.getByRole("button", { name: /Fechar/ }).click();
    await expect(panel).not.toBeVisible();
    await action.click();
    await expect(page.locator("#entryChoiceDialog")).toBeVisible();
    await page.locator("#entryChoiceClose").click();
    await expect(action).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("falha de pagamentos também invalida a contagem do histórico anterior", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/index.html#casa");
  await expect(page.locator("#settlementHistoryCount")).toContainText(
    "1 registro",
  );
  await page.route(BACKEND + "/settlements?month=08%2F2026", (r) =>
    r.fulfill({
      status: 503,
      json: { message: "Indisponibilidade controlada" },
    }),
  );
  await page.locator("#seletorMes").selectOption("08/2026");
  await expect(page.locator("#settlementHistoryCount")).toHaveText(
    "Não confirmado",
  );
  await expect(page.locator("#settlementHistoryList")).toBeEmpty();
  await expect(page.locator("#houseDebtOverview")).toContainText(
    "Acertos não carregaram",
  );
  await expect(page.locator('[data-module-error="acertos"]')).toBeHidden();
});
