import { test, expect } from "@playwright/test";
import { mockBackend, BACKEND } from "./helpers/mock-backend.mjs";

async function viewport(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, {
      width: innerWidth,
      height: 650,
      offsetTop: 60,
      offsetLeft: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", {
      value: viewport,
      configurable: true,
    });
  });
  await mockBackend(page);
  await page.goto("/index.html#assistente");
  await expect(page.locator("#assistantWelcome")).toBeVisible();
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return {
      panel: rect(".chat"),
      composer: rect("#assistantComposer"),
      send: rect(".composer-send"),
      heading: rect(".chat-heading"),
      height: visualViewport.height,
      top: visualViewport.offsetTop,
    };
  });
}
test("chat acompanha barras e deslocamento do Safari sem espaço vazio nem envio à esquerda", async ({
  page,
}) => {
  await viewport(page);
  let bounds = await geometry(page);
  expect(bounds.heading.top).toBeGreaterThanOrEqual(bounds.top);
  expect(bounds.panel.bottom).toBeCloseTo(bounds.top + bounds.height - 86, 0);
  expect(bounds.send.left).toBeGreaterThan(280);
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await page.evaluate(() => {
    Object.assign(visualViewport, { height: 730, offsetTop: 0 });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(async () => (await geometry(page)).panel.bottom)
    .toBeCloseTo(644, 0);
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await page.evaluate(() =>
    window.GastosNavigation.show("resumo", { instant: true }),
  );
  await expect(page.locator(".page")).not.toHaveCSS("position", "fixed");
});
test("compositor cabe com teclado e recupera navegação após fechá-lo", async ({
  page,
}) => {
  await viewport(page);
  await page.locator("#assistantText").focus();
  await page.evaluate(() => {
    Object.assign(visualViewport, { height: 390, offsetTop: 120 });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("body")).toHaveAttribute("data-chat-keyboard", "");
  await expect(page.locator(".mobile-nav")).toBeHidden();
  const bounds = await geometry(page);
  expect(bounds.heading.top).toBeGreaterThanOrEqual(120);
  expect(bounds.composer.bottom).toBeLessThanOrEqual(510);
  expect(bounds.send.left).toBeGreaterThan(280);
  expect(bounds.panel.bottom).toBeCloseTo(502, 0);
  await page.evaluate(() => {
    document.activeElement.blur();
    Object.assign(visualViewport, { height: 730, offsetTop: 0 });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await expect
    .poll(async () => (await geometry(page)).panel.bottom)
    .toBeCloseTo(644, 0);
});
test("resposta concluída não abre novamente teclado em dispositivo de toque", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await mockBackend(page);
  await page.route(BACKEND + "/assistant/chat", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"start"}\n\ndata: {"type":"text","text":"Resumo pronto."}\n\ndata: {"type":"end"}\n\n',
    }),
  );
  await page.goto("/index.html#assistente");
  await page.locator("#assistantText").fill("Resuma os gastos");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  await expect(page.locator("#assistantText")).not.toBeFocused();
  await context.close();
});
