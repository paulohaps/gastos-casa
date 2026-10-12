import { test, expect } from "@playwright/test";
import { BACKEND, mockBackend } from "./helpers/mock-backend.mjs";
async function setup(page, content, analysis) {
  await page.setViewportSize({ width: 390, height: 650 });
  await mockBackend(page);
  await page.route(BACKEND + "/assistant/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "start", ...(analysis ? { analysis } : {}) },
        { type: "text", text: content },
        { type: "end" },
      ]
        .map((event) => "data: " + JSON.stringify(event) + "\n\n")
        .join(""),
    }),
  );
  await page.goto("/index.html#assistente");
  await page.locator("#assistantText").fill("Resuma o período");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
}
test("resposta possui listas, destaques e cópia sem interpretar HTML do modelo", async ({
  page,
}) => {
  const text =
    '## Seu mês\nVocê gastou **R$ 56,00**.\n\n- Confira o mercado\n- Revise `categoria`\n\n1. Abra os gastos\n2. Compare os meses\n\n<img src=x onerror="window.injected=true">';
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.copied = text;
        },
      },
    }),
  );
  await setup(page, text);
  const answer = page.locator(".chat-message--assistant");
  await expect(answer.getByRole("heading", { name: "Seu mês" })).toBeVisible();
  await expect(answer.locator(".chat-response strong")).toHaveText("R$ 56,00");
  await expect(answer.locator("ul li")).toHaveCount(2);
  await expect(answer.locator("ol li")).toHaveCount(2);
  await expect(answer.locator("code")).toHaveText("categoria");
  await expect(answer.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await answer.getByRole("button", { name: "Copiar resposta" }).click();
  await expect(answer.getByRole("status")).toHaveText("Resposta copiada.");
  expect(await page.evaluate(() => window.copied)).toBe(text);
});
test("resumo de um mês aparece após explicação sem barra ou valor duplicado", async ({
  page,
}) => {
  const analysis = {
    startMonth: "2026-09",
    endMonth: "2026-09",
    total: 56,
    count: 1,
    months: [{ month: "2026-09", total: 56, count: 1 }],
  };
  await setup(page, "Seu principal gasto foi no mercado.", analysis);
  const answer = page.locator(".chat-message--assistant");
  await expect(answer.locator(".chat-analysis")).toContainText(
    "1 lançamento registrado",
  );
  await expect(answer.locator(".chat-month-track")).toHaveCount(0);
  await expect(
    answer.getByRole("button", { name: "Ver esses gastos" }),
  ).toHaveCount(0);
  await expect(answer.locator(".chat-analysis-heading strong")).toHaveText(
    "R$ 56,00",
  );
  await expect(answer.locator(".chat-month-bars strong")).toHaveCount(0);
  expect(
    await answer.evaluate((node) =>
      Boolean(
        node
          .querySelector(".chat-message-text")
          .compareDocumentPosition(node.querySelector(".chat-analysis")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
  await answer.getByRole("button", { name: /Ver gastos de/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "casa");
});
test("falha de copiar preserva conversa e voltar à última resposta mantém compositor acessível", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Negado");
        },
      },
    }),
  );
  const text = Array.from(
    { length: 20 },
    (_, index) =>
      "Parágrafo " + index + ": confira os gastos antes de decidir.",
  ).join("\n\n");
  await setup(page, text);
  await page.getByRole("button", { name: "Copiar resposta" }).click();
  await expect(page.locator('.chat-copy [role="status"]')).toContainText(
    "Não foi possível copiar",
  );
  await expect(page.locator(".chat-response")).toContainText("Parágrafo 19");
  await page
    .locator("#assistantMessages")
    .evaluate((node) => (node.scrollTop = 0));
  await expect(
    page.getByRole("button", { name: "Ir à última resposta ↓" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ir à última resposta ↓" }).click();
  await expect(page.locator(".chat-latest")).toHaveCount(0);
  await expect(page.locator("#assistantMessages")).toBeFocused();
  expect(
    await page
      .locator("#assistantMessages")
      .evaluate(
        (node) => node.scrollHeight - node.scrollTop - node.clientHeight,
      ),
  ).toBeLessThan(100);
  const composer = await page.locator("#assistantComposer").boundingBox();
  expect(composer.y + composer.height).toBeLessThanOrEqual(650);
});
