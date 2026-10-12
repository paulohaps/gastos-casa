import { test, expect } from "@playwright/test";
import { mockBackend, BACKEND } from "./helpers/mock-backend.mjs";

test("acertos identificam Dinheiro/Vale e mostram ações delimitadas na mesma linha", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.goto("/index.html#casa");
  await expect(page.locator("#boxAcertoDinheiro")).toContainText(
    "Falta R$ 20,25",
  );
  for (const selector of ["#boxAcertoDinheiro", "#boxAcertoVale"]) {
    const group = page.locator(selector);
    await expect(group.locator(".settlement-kind")).toBeVisible();
    expect(
      await group.locator("strong").evaluate((e) => getComputedStyle(e).color),
    ).not.toBe("rgb(255, 255, 255)");
    const actions = group.locator(".settlement-actions button");
    if (await actions.count()) {
      const a = await actions.nth(0).boundingBox(),
        b = await actions.nth(1).boundingBox();
      expect(a.y).toBe(b.y);
      expect(a.height).toBeGreaterThanOrEqual(48);
      expect(b.height).toBeGreaterThanOrEqual(48);
      expect(
        await actions
          .first()
          .evaluate((e) => getComputedStyle(e).backgroundColor),
      ).not.toBe("rgb(255, 255, 255)");
    }
  }
  await page
    .locator("#boxAcertoDinheiro")
    .getByRole("button", { name: "Quitar restante" })
    .click();
  await expect(page.locator("#settlementDialog")).toBeVisible();
  await expect(page.locator("#settlementAmount")).toHaveValue("20.25");
  await page.keyboard.press("Escape");
});

test("chat móvel usa compositor compacto e acompanha nova pergunta após ler mensagens antigas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  const answer = Array.from(
    { length: 30 },
    (_, i) => `Parágrafo ${i}: confira os gastos registrados antes de decidir.`,
  ).join("\n\n");
  await page.route(BACKEND + "/assistant/chat", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: [{ type: "start" }, { type: "text", text: answer }, { type: "end" }]
        .map((e) => "data: " + JSON.stringify(e) + "\n\n")
        .join(""),
    }),
  );
  await page.goto("/index.html#assistente");
  await page.locator("#assistantText").fill("Avalie os gastos");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  expect(
    (await page.locator("#assistantComposer").boundingBox()).height,
  ).toBeLessThanOrEqual(88);
  await expect(page.locator(".chat-footnote")).toHaveText(
    "A IA pode errar. Confira os valores.",
  );
  await page.locator("#assistantMessages").evaluate((e) => (e.scrollTop = 0));
  await expect(page.locator(".chat-latest")).toBeVisible();
  await page.locator("#assistantText").fill("E no mês anterior?");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator(".chat-message--user")).toHaveCount(2);
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  await expect(page.locator(".chat-latest")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("#assistantMessages")
        .evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight),
    )
    .toBeLessThanOrEqual(10);
});

test("streaming conserva leitura antiga e retorno ao fim acompanha a resposta completa", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = async (input, options) => {
      if (String(input).endsWith("/assistant/chat"))
        return new Response(
          new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              const send = (event) =>
                controller.enqueue(
                  encoder.encode("data: " + JSON.stringify(event) + "\n\n"),
                );
              send({ type: "start" });
              send({
                type: "text",
                text: "Confira os gastos antes de decidir.\n\n".repeat(40),
              });
              window.finishReply = () => {
                send({ type: "text", text: "Esta é a última orientação." });
                send({ type: "end" });
                controller.close();
              };
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      return original(input, options);
    };
  });
  await page.goto("/index.html#assistente");
  await page.locator("#assistantText").fill("Avalie os gastos");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator(".chat-response")).toContainText(
    "Confira os gastos",
  );
  await page.locator("#assistantMessages").evaluate((e) => (e.scrollTop = 0));
  await expect(page.locator(".chat-latest")).toBeVisible();
  await page.evaluate(() => window.finishReply());
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  expect(
    await page.locator("#assistantMessages").evaluate((e) => e.scrollTop),
  ).toBe(0);
  await page.locator(".chat-latest").click();
  await expect(page.locator("#assistantMessages")).toBeFocused();
  await expect
    .poll(() =>
      page
        .locator("#assistantMessages")
        .evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight),
    )
    .toBeLessThanOrEqual(10);
});
