import { test, expect } from "@playwright/test";
import { mockBackend, BACKEND } from "./helpers/mock-backend.mjs";
for (const width of [320, 390, 768, 1440])
  test(`contexto do chat não colide e preserva intervalo e histórico em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBackend(page);
    await page.goto("/index.html#assistente");
    await page.evaluate(() => document.fonts.ready);
    const collisions = await page.evaluate(() => {
      const summary = document.querySelector(".chat-period summary"),
        history = document.querySelector(".chat-history>summary");
      const range = document.createRange();
      range.selectNodeContents(summary);
      const a = range.getBoundingClientRect(),
        b = history.getBoundingClientRect();
      return (
        Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
        Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
      );
    });
    expect(collisions).toBe(false);
    await page.locator(".chat-history>summary").click();
    await expect(page.locator(".chat-history-list")).toBeVisible();
    await page.locator(".chat-history>summary").click();
    await page.locator(".chat-period>summary").click();
    await page.getByRole("button", { name: "3 meses", exact: true }).click();
    await expect(page.locator(".chat-period>summary")).toContainText("jul.");
  });
test("cadastro manual começa por valor e descrição; captura inteligente continua disponível", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.goto("/index.html#lancar");
  await expect(page.locator("#inputValor")).toBeVisible();
  const positions = await page.evaluate(() =>
    [
      "inputValor",
      "inputDescricao",
      "inputData",
      "btnSubmit",
      "smartEntryPanel",
    ].map((id) => document.getElementById(id).getBoundingClientRect().top),
  );
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  await expect(page.locator("#smartEntryPanel")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.locator("#smartEntryPanel>summary").click();
  await expect(page.locator("#btnFalarSmart")).toBeVisible();
  await expect(page.locator("#btnSmartScanner")).toBeVisible();
  await expect(page.locator("#btnInterpretarSmart")).toBeVisible();
});
test("pontos do gráfico oferecem toque e teclado e atualizam o período global", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/index.html");
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
  const point = page.getByRole("button", {
    name: /Selecionar ago.*no gráfico/,
  });
  await point.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#seletorMes")).toHaveValue("08/2026");
  await expect(page.locator("#homeHouseTotal")).toContainText("290");
});
test("conta e preferências precedem integrações, com atalho do chat abrindo a seção correta", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.goto("/index.html#ajustes");
  await expect(page.getByLabel("Seção dos ajustes")).toHaveValue(
    "settingsAccount",
  );
  await expect(page.locator("#settingsIntegrations")).not.toHaveAttribute(
    "open",
    "",
  );
  const order = await page.evaluate(() =>
    ["settingsAccount", "settingsPreferences", "settingsIntegrations"].map(
      (id) => document.getElementById(id).getBoundingClientRect().top,
    ),
  );
  expect(order).toEqual([...order].sort((a, b) => a - b));
  await page.getByLabel("Seção dos ajustes").selectOption("aiSettingsPanel");
  await expect(page.locator("#aiApiKey")).toBeVisible();
  await page.locator('nav [data-app-nav="assistente"]:visible').first().click();
  await page.getByRole("button", { name: "Configurar conexão de IA" }).click();
  await expect(page.locator("#aiSettingsPanel")).toBeVisible();
  await expect(page.getByLabel("Seção dos ajustes")).toHaveValue(
    "aiSettingsPanel",
  );
});
test("pagamentos indisponíveis removem saldo e ações do mês anterior", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/index.html#casa");
  await expect(page.locator("#boxAcertoDinheiro")).toContainText("20,25");
  await page.route(BACKEND + "/settlements?month=08%2F2026", (r) =>
    r.fulfill({ status: 503, json: { message: "Sem pagamentos" } }),
  );
  await page.locator("#seletorMes").selectOption("08/2026");
  await expect(page.locator('[data-module-error="acertos"]')).toContainText(
    "Sem pagamentos",
  );
  await expect(page.locator("#boxAcertoDinheiro")).toBeEmpty();
  await expect(page.locator("#boxAcertoVale")).toBeEmpty();
});
test("servidor sem capacidade atômica preserva histórico e bloqueia novos pagamentos", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route(BACKEND + "/settlements?**", (r) =>
    r.fulfill({ json: { settlements: [] } }),
  );
  await page.goto("/index.html#casa");
  await expect(page.locator('[data-module-error="acertos"]')).toContainText(
    "atualização financeira",
  );
  await expect(page.locator(".settlement-actions button")).toHaveCount(0);
  await page.evaluate(() =>
    window.GastosSettlements.openForm("Dinheiro", true),
  );
  await expect(page.locator("#settlementDialog")).not.toBeVisible();
});
test("retry do mesmo pagamento conserva idempotência após falha de rede", async ({
  page,
}) => {
  await mockBackend(page);
  const payloads = [];
  await page.route(BACKEND + "/settlements", (r) => {
    const body = r.request().postDataJSON();
    payloads.push(body);
    return payloads.length === 1
      ? r.fulfill({ status: 503, json: { message: "Tente novamente" } })
      : r.fulfill({ json: { ok: true, data: [{ id: "s2" }] } });
  });
  await page.goto("/index.html#casa");
  await expect(page.locator("#boxAcertoDinheiro")).toContainText("20,25");
  await page.evaluate(() =>
    window.GastosSettlements.openForm("Dinheiro", true),
  );
  await page.locator("#settlementSubmit").click();
  await expect(page.locator("#settlementStatus")).toContainText(
    "Tente novamente",
  );
  await page.locator("#settlementSubmit").click();
  await expect(page.locator("#settlementDialog")).not.toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[0].idempotencyKey).toBe(payloads[1].idempotencyKey);
});
test("resposta completa com mais de mil despesas mantém indicadores e histórico", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route(BACKEND + "/expenses?month=09%2F2026", (r) =>
    r.fulfill({
      json: {
        complete: true,
        expenses: Array.from({ length: 1001 }, (_, i) => ({
          id: String(i),
          data: "2026-09-01",
          usuario: "Paulo Henrique",
          valor: 1,
          descricao: "Despesa " + i,
          categoria: "Outros",
          forma_pagamento: "Dinheiro",
        })),
      },
    }),
  );
  await page.goto("/index.html");
  await expect(page.locator("#homeHouseTotal")).toContainText("1.001,00");
  await expect(page.locator(".transaction-toolbar")).toContainText("1001");
});
test("seções progressivas têm área de toque no tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await mockBackend(page);
  await page.goto("/index.html");
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
  for (const selector of [
    ".dashboard-distribution>summary",
    ".dashboard-balance>summary",
  ])
    expect(
      (await page.locator(selector).boundingBox()).height,
    ).toBeGreaterThanOrEqual(44);
});
test("falha de orçamento e base anterior não vira sem meta, sem base ou radar estável", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route(BACKEND + "/budgets?**", (r) =>
    r.fulfill({ status: 503, json: { message: "Limites indisponíveis" } }),
  );
  await page.route(BACKEND + "/expenses?month=08%2F2026", (r) =>
    r.fulfill({ status: 503, json: { message: "Histórico indisponível" } }),
  );
  await page.goto("/index.html#casa");
  await expect(page.locator("#cardOrcamentoValor")).toHaveText("Indisponível");
  await expect(page.locator("#cardComparativoValor")).toHaveText(
    "Indisponível",
  );
  await expect(page.locator("#projecaoMesValor")).toHaveText("—");
  await expect(page.locator("#radarStatus")).toHaveText("Indisponível");
});
for (const width of [320, 768, 1440])
  test(`escala monetária mantém texto legível em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBackend(page);
    await page.goto("/index.html");
    await expect(page.locator("#homeHouseTotal")).toContainText("366");
    await expect
      .poll(() =>
        page
          .locator(".trend-axis")
          .first()
          .evaluate(
            (node) =>
              parseFloat(getComputedStyle(node).fontSize) *
              node.getScreenCTM().a,
          ),
      )
      .toBeGreaterThanOrEqual(11.9);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
