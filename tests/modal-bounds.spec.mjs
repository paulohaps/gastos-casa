import { test, expect } from "@playwright/test";
import { mockBackend } from "./helpers/mock-backend.mjs";

async function assertBounds(dialog, viewport) {
  const bounds = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      overflow: node.scrollWidth > node.clientWidth + 1,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(viewport.left ?? 0);
  expect(bounds.top).toBeGreaterThanOrEqual(viewport.top ?? 0);
  expect(bounds.right).toBeLessThanOrEqual(
    (viewport.left ?? 0) + viewport.width + 1,
  );
  expect(bounds.bottom).toBeLessThanOrEqual(
    (viewport.top ?? 0) + viewport.height + 1,
  );
  expect(bounds.overflow).toBe(false);
}
async function simulateKeyboard(page) {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, {
      width: innerWidth,
      height: innerHeight,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    window.setTestViewport = (values) => {
      Object.assign(viewport, values);
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    };
  });
}
for (const width of [320, 390])
  test(
    "todos os diálogos cabem com teclado e viewport deslocado em " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await mockBackend(page);
      await simulateKeyboard(page);
      await page.goto("/index.html#assistente");
      await expect(page.locator("#assistantComposer")).toBeVisible();
      const dialogs = await page
        .locator("dialog")
        .evaluateAll((nodes) =>
          nodes.map((node) =>
            node.id ? "#" + node.id : ".chat-delete-dialog",
          ),
        );
      expect(dialogs).toHaveLength(10);
      for (const selector of dialogs) {
        await page.evaluate(
          (selector) => document.querySelector(selector).showModal(),
          selector,
        );
        const dialog = page.locator(selector);
        await assertBounds(dialog, { width, height: 844 });
        await page.evaluate(() =>
          window.setTestViewport({ height: 280, offsetTop: 110 }),
        );
        await expect
          .poll(() =>
            dialog.evaluate((node) => node.getBoundingClientRect().bottom),
          )
          .toBeLessThanOrEqual(391);
        await assertBounds(dialog, { width, height: 280, top: 110 });
        await page.evaluate(
          (width) =>
            window.setTestViewport({ width: width - 40, offsetLeft: 20 }),
          width,
        );
        await expect
          .poll(() =>
            dialog.evaluate((node) => node.getBoundingClientRect().right),
          )
          .toBeLessThanOrEqual(width - 19);
        await assertBounds(dialog, {
          width: width - 40,
          height: 280,
          top: 110,
          left: 20,
        });
        await dialog.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await assertBounds(dialog, {
          width: width - 40,
          height: 280,
          top: 110,
          left: 20,
        });
        await page.evaluate(
          (selector) => document.querySelector(selector).close(),
          selector,
        );
        await page.evaluate(() =>
          window.setTestViewport({
            height: 844,
            offsetTop: 0,
            width: innerWidth,
            offsetLeft: 0,
          }),
        );
      }
    },
  );
test("confirmação do chat não corta botões em 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await mockBackend(page);
  await page.goto("/index.html#assistente");
  const dialog = page.locator(".chat-delete-dialog");
  await dialog.evaluate((node) => node.showModal());
  await assertBounds(dialog, { width: 320, height: 480 });
  const area = await dialog.boundingBox();
  for (const button of await dialog.getByRole("button").all()) {
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(area.x);
    expect(box.x + box.width).toBeLessThanOrEqual(area.x + area.width);
  }
});
test("login cabe acima do teclado, rola até Entrar e volta ao fechar teclado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockBackend(page);
  await simulateKeyboard(page);
  await page.addInitScript(() =>
    localStorage.removeItem("gastos_pwa_session_token_v2"),
  );
  await page.goto("/index.html");
  const dialog = page.locator("#authDialog");
  await expect(page.locator("#authForm")).toBeVisible();
  await page.locator("#authEmail").focus();
  await page.evaluate(() =>
    window.setTestViewport({ height: 260, offsetTop: 80 }),
  );
  await expect
    .poll(() => dialog.evaluate((node) => node.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(341);
  await assertBounds(dialog, { width: 320, height: 260, top: 80 });
  await page.locator("#authSubmit").scrollIntoViewIfNeeded();
  const button = await page.locator("#authSubmit").boundingBox();
  expect(button.y + button.height).toBeLessThanOrEqual(340);
  await page.evaluate(() =>
    window.setTestViewport({
      height: 844,
      offsetTop: 0,
      width: innerWidth,
      offsetLeft: 0,
    }),
  );
  await expect
    .poll(() => dialog.evaluate((node) => node.clientHeight))
    .toBeGreaterThan(260);
  await assertBounds(dialog, { width: 320, height: 844 });
});
