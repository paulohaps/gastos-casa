import { test, expect } from "@playwright/test";
import { mockBackend, BACKEND } from "./helpers/mock-backend.mjs";
for (const width of [320, 390])
  test(`saída visível do chat com teclado em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      const v = new EventTarget();
      Object.assign(v, {
        width: innerWidth,
        height: innerHeight,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
      });
      Object.defineProperty(window, "visualViewport", {
        value: v,
        configurable: true,
      });
    });
    await mockBackend(page);
    await page.goto("/index.html#assistente");
    await expect(page.locator("#assistantWelcome")).toBeVisible();
    await page.locator("#assistantText").focus();
    await page.evaluate(() => {
      Object.assign(visualViewport, { height: 390, offsetTop: 75 });
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator("body")).toHaveAttribute(
      "data-chat-keyboard",
      "",
    );
    await expect(page.locator(".mobile-nav")).toBeHidden();
    const exit = page.getByRole("link", { name: "Voltar ao Início" });
    await expect(exit).toBeVisible();
    const box = await exit.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(75);
    expect(box.y + box.height).toBeLessThanOrEqual(465);
    await exit.click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-app-view",
      "resumo",
    );
    await expect(page.locator("#homeView")).toBeVisible();
    await expect(page.locator(".page")).not.toHaveCSS("position", "fixed");
    expect(
      await page.evaluate(() =>
        localStorage.getItem("gastos_pwa_session_token_v2"),
      ),
    ).toBe("visual-test-token");
  });
test("saída do Assistente funciona por teclado", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await mockBackend(page);
  await page.goto("/index.html#assistente");
  const exit = page.getByRole("link", { name: "Voltar ao Início" });
  await exit.focus();
  await expect(exit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "resumo");
});
test("sair do chat e retornar conserva conversa e pergunta em rascunho", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.route(BACKEND + "/assistant/chat", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"start"}\n\ndata: {"type":"text","text":"Confira os gastos registrados."}\n\ndata: {"type":"end"}\n\n',
    }),
  );
  await page.goto("/index.html#assistente");
  await page.locator("#assistantText").fill("Resuma meus gastos");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  await page.locator("#assistantText").fill("Quero comparar com agosto");
  await page.getByRole("link", { name: "Voltar ao Início" }).click();
  await page.locator('nav [data-app-nav="assistente"]:visible').click();
  await expect(page.locator(".chat-response")).toContainText(
    "Confira os gastos registrados",
  );
  await expect(page.locator("#assistantText")).toHaveValue(
    "Quero comparar com agosto",
  );
});

for (const width of [320, 390])
  test(`ações frequentes têm alvos de toque de 48px em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockBackend(page);
    await page.goto("/index.html#resumo");
    await expect(page.locator("#homeHouseTotal")).toContainText("R$");
    for (const selector of [
      ".mobile-brand",
      "#seletorMes",
      ".home-activity .text-link",
    ]) {
      const control = page.locator(selector);
      const box = await control.first().boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
    await page.locator('nav [data-app-nav="ajustes"]:visible').click();
    await expect(page.locator("#aiKeyLink")).toBeVisible();
    await page.locator("details:has(#smartMetricsDays) summary").click();
    for (const selector of [
      "#aiKeyLink",
      ".ai-data-help summary",
      ".smart-rule-item__controls select",
      "#smartMetricsDays",
    ]) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box.height, selector).toBeGreaterThanOrEqual(48);
    }
  });
