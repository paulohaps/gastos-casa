import { test, expect } from "@playwright/test";
import { mockBackend, BACKEND } from "./helpers/mock-backend.mjs";
for (const width of [320, 1440])
  test(`envio incerto conserva operação e permite novo lançamento explícito ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBackend(page);
    const posts = [];
    await page.route(BACKEND + "/expenses", (r) => {
      if (r.request().method() !== "POST") return r.fallback();
      posts.push(r.request().postDataJSON());
      return posts.length === 1
        ? r.abort("failed")
        : r.fulfill({ json: { ok: true } });
    });
    await page.goto("/index.html#lancar");
    await expect(page.locator("#homeHouseTotal")).toContainText("366");
    await page.locator("#inputValor").fill("12.30");
    await page.locator("#inputDescricao").fill("Tentativa sintética");
    await page.locator("#btnSubmit").click();
    await expect(page.locator("#btnSubmit")).toBeEnabled();
    await expect(page.locator("#expensePendingAttempt")).toBeVisible();
    expect(posts[0].idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
    await page.evaluate(() => window.GastosExpenses.cancelEdit());
    await page.locator("#inputValor").fill("12.30");
    await page.locator("#inputDescricao").fill("Tentativa sintética");
    await page.locator("#inputValor").fill("14");
    await page.locator("#btnSubmit").click();
    await expect(page.locator("#toast")).toContainText("envio sem confirmação");
    expect(posts.length).toBe(1);
    await page.locator("#inputValor").fill("12.30");
    await page.locator("#btnSubmit").click();
    await expect(page.locator("#btnSubmit")).toBeEnabled();
    expect(posts.length).toBe(2);
    expect(posts[1].idempotencyKey).toBe(posts[0].idempotencyKey);
    await expect(page.locator("#expensePendingAttempt")).toHaveCount(0);
    await page.locator("#inputValor").fill("12.30");
    await page.locator("#inputDescricao").fill("Tentativa sintética");
    await page.locator("#btnSubmit").click();
    await expect.poll(() => posts.length).toBe(3);
    expect(posts[2].idempotencyKey).not.toBe(posts[0].idempotencyKey);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("edição retorna ao modo novo, falha auxiliar não anuncia gravação perdida", async ({
  page,
}) => {
  const posts = [];
  await mockBackend(page, { onExpensePost: (p) => posts.push(p) });
  await page.goto("/index.html#casa");
  await expect(page.locator("#cardTotal")).toContainText("366");
  await page.locator('[data-house-tab="despesas"]').click();
  await page
    .getByRole("button", { name: "Editar Mercado da semana", exact: true })
    .click();
  await page.locator("#btnSubmit").click();
  await expect(page.locator("#btnSubmit")).toBeEnabled();
  await expect(page.locator("#btnSubmit")).toContainText("Lançar Despesa");
  await page.evaluate(() => {
    window.GastosSmartEntry.afterExpenseSaved = () => {
      throw Error("Synthetic auxiliary failure");
    };
  });
  await page.locator("#inputValor").fill("12");
  await page.locator("#inputDescricao").fill("Confirmada");
  await page.locator("#btnSubmit").click();
  await expect(page.locator("#btnSubmit")).toBeEnabled();
  await expect(page.locator("#toast")).toContainText("Despesa salva");
  expect(posts.map((p) => p.action)).toEqual(["update", "add"]);
});
for (const width of [390, 1440])
  test(`cartão mensal do chat sincroniza dados ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBackend(page);
    await page.route(BACKEND + "/expenses?month=08%2F2026", (r) =>
      r.fulfill({
        json: {
          complete: true,
          expenses: [
            {
              id: "aug",
              data: "2026-08-12",
              usuario: "Paulo Henrique",
              valor: 75,
              descricao: "Somente agosto",
              categoria: "Mercado",
              forma_pagamento: "Dinheiro",
            },
          ],
        },
      }),
    );
    await page.route(BACKEND + "/settlements?month=08%2F2026", (r) =>
      r.fulfill({
        json: { complete: true, atomicSettlements: true, settlements: [] },
      }),
    );
    await page.route(BACKEND + "/assistant/chat", (r) =>
      r.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "start",
            analysis: {
              startMonth: "2026-08",
              endMonth: "2026-08",
              total: 75,
              count: 1,
              months: [{ month: "2026-08", total: 75, count: 1 }],
            },
          },
          { type: "text", text: "Agosto." },
          { type: "end" },
        ]
          .map((e) => "data: " + JSON.stringify(e) + "\n\n")
          .join(""),
      }),
    );
    await page.goto("/index.html#assistente");
    await expect(page.locator("#homeHouseTotal")).toContainText("366");
    await page.locator("#assistantMonth").fill("2026-08");
    await expect(page.locator("#assistantText")).toBeEditable();
    await page.locator("#assistantText").fill("Gastos do período");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.locator("#assistantComposerStatus")).toContainText(
      "Resposta concluída",
    );
    await page.getByRole("button", { name: /Ver gastos de ago/ }).click();
    await expect(page.locator("#seletorMes")).toHaveValue("08/2026");
    await expect(page.locator("#filtroTotal")).toContainText("75,00");
    await expect(page.locator("#tabelaHistorico")).toContainText(
      "Somente agosto",
    );
    await expect(page.locator("#homeHouseTotal")).toContainText("75,00");
  });
for (const [zone, time, day] of [
  ["America/Sao_Paulo", "2026-09-23T02:30:00Z", "2026-09-22"],
  ["Pacific/Kiritimati", "2026-09-22T12:30:00Z", "2026-09-23"],
])
  test.describe(zone, () => {
    test.use({ timezoneId: zone });
    test("data local no formulário e no Cofre", async ({ page }) => {
      await mockBackend(page);
      await page.clock.setFixedTime(new Date(time));
      const id = "22222222-2222-4222-8222-222222222222";
      await page.route(BACKEND + "/wallets", (r) =>
        r.fulfill({
          json: { wallets: [{ id, nome: "Pessoal", limite_mensal: 100 }] },
        }),
      );
      await page.route(BACKEND + "/wallets/expenses?**", (r) =>
        r.fulfill({
          json: {
            expenses: [],
            plan: {
              month: new URL(r.request().url()).searchParams.get("month"),
              spent: 0,
              budget: 100,
              remaining: 100,
              daily: 1,
              remainingDays: 10,
              signals: [],
            },
          },
        }),
      );
      await page.goto("/index.html#casa");
      await expect(page.locator("#cardTotal")).toContainText("366");
      await expect(page.locator("#inputData")).toHaveValue(day);
      await page.locator('[data-house-tab="despesas"]').click();
      await page
        .getByRole("button", {
          name: "Duplicar Mercado da semana",
          exact: true,
        })
        .click();
      await expect(page.locator("#inputData")).toHaveValue(day);
      await page.evaluate(() => window.GastosExpenses.cancelEdit());
      await expect(page.locator("#inputData")).toHaveValue(day);
      await page.evaluate(() => window.GastosWallets.beginExpense());
      await expect(page.locator("#walletExpenseDate")).toHaveValue(day);
    });
  });

test("comparativo corta futuros nos dois lados sem retirar do total mensal", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route(BACKEND + "/expenses?**", (r) => {
    const month = new URL(r.request().url()).searchParams
      .get("month")
      .split("/")
      .reverse()
      .join("-");
    const one = {
      id: month,
      data: month + "-05",
      usuario: "Paulo Henrique",
      valor: 100,
      descricao: "Gasto sintético",
      categoria: "Mercado",
      forma_pagamento: "Dinheiro",
    };
    return r.fulfill({
      json: {
        complete: true,
        expenses:
          month === "2026-09"
            ? [one, { ...one, id: "future", data: "2026-09-30", valor: 500 }]
            : [one],
      },
    });
  });
  await page.goto("/index.html#casa");
  await expect(page.locator("#cardTotal")).toContainText("600,00");
  await expect(page.locator("#cardComparativoValor")).toHaveText("0,0%");
  await expect(page.locator("#riscoOrcamentoTexto")).toContainText("Mercado em 86%");
  await expect(page.locator("#cardComparativoTexto")).toContainText(
    "22/09/2026",
  );
});
