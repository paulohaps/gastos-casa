import { test, expect } from "@playwright/test";
import { mockBackend, BACKEND } from "./helpers/mock-backend.mjs";
for (const width of [320, 390, 1440])
  test(`gastos precedem acertos e erro isolado não toma a tela em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBackend(page);
    let fail = true;
    await page.route(BACKEND + "/settlements?**", (r) =>
      fail
        ? r.fulfill({
            status: 503,
            json: { message: "Serviço de pagamentos fora" },
          })
        : r.fulfill({
            json: { atomicSettlements: true, complete: true, settlements: [] },
          }),
    );
    await page.goto("/index.html");
    await expect(page.locator("#homeHouseTotal")).toContainText("366,40");
    await expect(page.locator("#homePayable")).toHaveText("—");
    const notice = page.getByRole("region", {
      name: "Disponibilidade dos acertos",
    });
    await expect(notice).toContainText("Acertos não carregaram");
    await expect(
      notice.getByRole("button", { name: "Tentar novamente" }),
    ).toHaveCount(1);
    expect(
      (await page.locator("#homeHouseTotal").boundingBox()).y,
    ).toBeLessThan((await notice.boundingBox()).y);
    await expect(
      page.getByText("Alguns módulos não carregaram.", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Leitura dos gastos" }),
    ).toContainText("Amostra pequena");
    fail = false;
    await notice.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.locator("#homePayable")).toContainText("30,25");
    await expect(notice).toHaveCount(0);
    await page.locator('[data-app-nav="casa"]:visible').first().click();
    fail = true;
    await page.evaluate(() => window.mudarMes());
    await expect(page.locator("#houseDebtOverview")).toContainText(
      "Acertos não carregaram",
    );
    await expect(page.locator('[data-module-error="acertos"]')).toBeHidden();
    await expect(page.locator(".settlement-actions button")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
for (const [payload, message] of [
  [{ complete: true, settlements: [] }, "atualização do serviço"],
  [{ atomicSettlements: true, settlements: [] }, "Faltam pagamentos"],
])
  test(`acertos distinguem ${message} de falha de rede`, async ({ page }) => {
    await mockBackend(page);
    await page.route(BACKEND + "/settlements?**", (r) =>
      r.fulfill({ json: payload }),
    );
    await page.goto("/index.html");
    await expect(page.locator(".balance-summary")).toContainText(message);
    await expect(page.locator(".balance-summary")).not.toContainText(
      "Acertos não carregaram",
    );
    await expect(page.locator("#homePayable")).toHaveText("—");
    await expect(page.locator("#homeHouseTotal")).toContainText("366,40");
  });
test("leitura financeira reage aos mesmos filtros e não confunde concentração com hábito", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/index.html");
  const reading = page.getByRole("region", { name: "Leitura dos gastos" });
  await expect(reading).toContainText("Contas");
  await expect(reading).toContainText("49,3%");
  await page.getByLabel("Categoria", { exact: true }).selectOption("Mercado");
  await expect(reading).toContainText("100%");
  await expect(reading).toContainText("Mercado");
  await expect(reading).toContainText("ainda não um padrão");
  await page.getByRole("tab", { name: "Movimentações", exact: true }).click();
  await page.locator("#dashboardQuery").fill("não existe");
  await page.getByRole("tab", { name: "Agora", exact: true }).click();
  await expect(reading).toHaveCount(0);
  await expect(page.locator("#homeHouseTotal")).toContainText("0,00");
});
test("rota de acertos ausente é atualização pendente, sem sugerir retry de rede", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route(BACKEND + "/settlements?**", (r) =>
    r.fulfill({ status: 404, json: { message: "Não encontrado" } }),
  );
  await page.goto("/index.html");
  await expect(page.locator("#homeHouseTotal")).toContainText("366,40");
  const notice = page.getByRole("region", {
    name: "Disponibilidade dos acertos",
  });
  await expect(notice).toContainText("atualização do serviço");
  await expect(
    notice.getByRole("button", { name: "Tentar novamente" }),
  ).toHaveCount(0);
  await page.locator('[data-app-nav="casa"]:visible').first().click();
  await expect(page.locator("#houseDebtOverview")).toContainText(
    "atualização financeira",
  );
  await expect(page.locator(".settlement-actions button")).toHaveCount(0);
});
