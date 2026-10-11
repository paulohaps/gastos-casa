import { test, expect } from "@playwright/test";
import { BACKEND, mockBackend } from "./helpers/mock-backend.mjs";
const walletId = "22222222-2222-4222-8222-222222222222";
const stream = (text, context) =>
  [
    { type: "start", context },
    { type: "text", text: text.slice(0, 8) },
    { type: "text", text: text.slice(8) },
    { type: "end", token: "visual-test-token" },
  ]
    .map((event) => "data: " + JSON.stringify(event) + "\n\n")
    .join("");
async function open(page, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await mockBackend(page);
  await page.route(BACKEND + "/wallets", (route) =>
    route.fulfill({
      json: {
        wallets: [{ id: walletId, nome: "Minha carteira", limite_mensal: 500 }],
      },
    }),
  );
  await page.goto("/index.html#assistente");
  await expect(page.locator("#assistantContext option")).toHaveCount(2);
}
async function send(page, text) {
  await page.locator("#assistantText").fill(text);
  await page.locator('#assistantComposer [type="submit"]').click();
}
for (const width of [320, 390, 1366])
  test(
    "chat claro, histórico real e revisão explícita em " + width,
    async ({ page }) => {
      const payloads = [],
        writes = [],
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await open(page, width);
      await page.route(BACKEND + "/assistant/chat", (route) => {
        const payload = route.request().postDataJSON();
        payloads.push(payload);
        return route.fulfill({
          contentType: "text/event-stream",
          body: stream(
            "Você pode revisar os gastos do mercado antes de decidir.",
            payload.context,
          ),
        });
      });
      page.on("request", (req) => {
        if (
          ["/expenses", "/wallets/expenses"].includes(
            new URL(req.url()).pathname,
          ) &&
          req.method() === "POST"
        )
          writes.push(req.postDataJSON());
      });
      await send(page, "Onde mais gastei?");
      await expect(page.locator(".chat-message--assistant")).toContainText(
        "mercado",
      );
      await expect(page.locator("#assistantComposerStatus")).toContainText(
        "Resposta concluída",
      );
      await send(page, "Paguei 87,50 no mercado hoje no PIX");
      await expect(page.locator(".chat-message--assistant")).toHaveCount(2);
      await expect(page.locator("#assistantComposerStatus")).toContainText(
        "Resposta concluída",
      );
      expect(payloads[1].messages).toHaveLength(3);
      expect(payloads[1].messages[1]).toMatchObject({
        role: "assistant",
        content: "Você pode revisar os gastos do mercado antes de decidir.",
      });
      await expect(page.locator("body")).toHaveAttribute(
        "data-app-view",
        "assistente",
      );
      expect(writes).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const composer = await page.locator("#assistantComposer").boundingBox();
      expect(composer.x).toBeGreaterThanOrEqual(0);
      expect(composer.x + composer.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: "test-results/new-chat-" + width + ".png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Revisar como gasto" }).click();
      await expect(page.locator("#smartEntryPreview")).toBeVisible();
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    },
  );
test("erro 503 preserva mensagem e sessão; nova tentativa mantém uma única mensagem do usuário", async ({
  page,
}) => {
  await open(page);
  let calls = 0;
  await page.route(BACKEND + "/assistant/chat", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 503,
          json: { message: "IA indisponível. Tente novamente." },
        })
      : route.fulfill({
          contentType: "text/event-stream",
          body: stream(
            "Resposta recuperada.",
            route.request().postDataJSON().context,
          ),
        });
  });
  await send(page, "Compare os meses.");
  await expect(page.locator("#assistantError")).toContainText(
    "IA indisponível",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBeTruthy();
  await expect(page.locator("#authDialog")).toHaveCount(0);
  await page.locator("#assistantRetry").click();
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  await expect(page.locator(".chat-message--user")).toHaveCount(1);
  await expect(page.locator(".chat-message--assistant")).toHaveCount(1);
  await expect(page.locator("#assistantError")).toBeHidden();
});
test("resposta incompleta e erro SSE não são tratados como sucesso nem enviados ao próximo histórico", async ({
  page,
}) => {
  await open(page);
  let last;
  await page.route(BACKEND + "/assistant/chat", (route) => {
    last = route.request().postDataJSON();
    return route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"text","text":"Resposta parcial"}\n\ndata: {"type":"error","code":"KEY_REJECTED","message":"Confira sua chave de IA."}\n\n',
    });
  });
  await send(page, "Onde gastei?");
  await expect(page.locator("#assistantError")).toContainText(
    "Confira sua chave",
  );
  await expect(page.locator("#assistantConfigure")).toBeVisible();
  await expect(page.locator(".chat-message--assistant")).toContainText(
    "Resposta parcial",
  );
  await send(page, "Quero economizar.");
  await expect(page.locator(".chat-message--user")).toHaveCount(2);
  expect(last.messages).toEqual([
    { role: "user", content: "Quero economizar." },
  ]);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBeTruthy();
});
test("trocar carteira ou período separa conversas e não mistura o histórico de Casa", async ({
  page,
}) => {
  await open(page);
  const payloads = [];
  await page.route(BACKEND + "/assistant/chat", (route) => {
    const payload = route.request().postDataJSON();
    payloads.push(payload);
    return route.fulfill({
      contentType: "text/event-stream",
      body: stream("Resposta do contexto selecionado.", payload.context),
    });
  });
  await send(page, "Gastos da casa?");
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  await page.locator("#assistantContext").selectOption(walletId);
  await expect(page.locator(".chat-message")).toHaveCount(0);
  await send(page, "Posso gastar R$ 150?");
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  expect(payloads.at(-1).context).toMatchObject({ scope: "wallet", walletId });
  expect(payloads.at(-1).messages).toHaveLength(1);
  await page.locator("#assistantMonth").fill("2026-08");
  await page.locator("#assistantMonth").dispatchEvent("change");
  await expect(page.locator(".chat-message")).toHaveCount(0);
  await page.locator("#assistantContext").selectOption("house");
  await page.locator("#assistantMonth").fill("2026-09");
  await page.locator("#assistantMonth").dispatchEvent("change");
  await expect(page.locator(".chat-message--user")).toHaveCount(1);
  await expect(page.locator(".chat-message--user")).toContainText(
    "Gastos da casa",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("gastos:sessioncleared")),
  );
  await expect(page.locator(".chat-message")).toHaveCount(0);
  await expect(page.locator("#assistantContext option")).toHaveCount(1);
});
test("parar cancela a requisição e trocar contexto descarta resposta atrasada", async ({
  page,
}) => {
  await open(page);
  let resolve,
    requests = 0;
  await page.route(BACKEND + "/assistant/chat", async (route) => {
    requests++;
    await new Promise((next) => {
      resolve = next;
    });
    await route
      .fulfill({
        contentType: "text/event-stream",
        body: stream(
          "Resposta antiga não deve aparecer.",
          route.request().postDataJSON().context,
        ),
      })
      .catch(() => {});
  });
  await send(page, "Analise a casa");
  await expect(page.locator("#assistantStop")).toBeVisible();
  await expect.poll(() => requests).toBe(1);
  await page.locator("#assistantStop").click();
  await expect(page.locator("#assistantError")).toContainText("interrompida");
  await page.locator("#assistantContext").selectOption(walletId);
  resolve();
  await expect(page.locator(".chat-message")).toHaveCount(0);
  await expect(
    page.locator('#assistantComposer [type="submit"]'),
  ).toBeEnabled();
});
test("sem chave guia para conectar IA e mantém a pergunta sem simular resposta", async ({
  page,
}) => {
  await open(page);
  await page.route(BACKEND + "/assistant/chat", (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: "AI_NOT_CONFIGURED",
        message: "Conecte Gemini ou DeepSeek em Ajustes para conversar.",
      },
    }),
  );
  await send(page, "Onde posso economizar?");
  await expect(page.locator("#assistantConfigure")).toBeVisible();
  await expect(page.locator("#assistantRetry")).toBeHidden();
  await expect(page.locator(".chat-message--user")).toContainText("economizar");
  await page.locator("#assistantConfigure").click();
  await expect(page.locator("#aiSettingsPanel")).toBeVisible();
});
test('sessão encerrada remove dados pessoais do Cofre e o histórico do chat', async ({ page }) => {
  await open(page);
  await page.route(BACKEND + '/wallets/expenses**', route => route.fulfill({ json: {
    expenses: [{ id: '1', data: '2026-09-01', valor: 20, descricao: 'Gasto privado anterior', categoria: 'Mercado' }],
    plan: { spent: 20, budget: 500, remaining: 480, daily: null, remainingDays: 0, month: '2026-09', count: 1, categories: {}, signals: [] }, aiConfigured: false
  } }));
  await page.locator('nav [data-app-nav="carteiras"]:visible').first().click();
  await expect(page.locator('#walletExpenseList')).toContainText('Gasto privado anterior');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('gastos:sessioncleared')));
  await expect(page.locator('#walletExpenseList')).not.toContainText('Gasto privado anterior');
  await expect(page.locator('#walletSelectedName')).toHaveText('');
  await expect(page.locator('#walletSpent')).toHaveText('—');
  await expect(page.locator('.chat-message')).toHaveCount(0);
});
