import { test, expect } from "@playwright/test";
import { BACKEND, mockBackend } from "./helpers/mock-backend.mjs";
const respond = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
async function ready(page) {
  await mockBackend(page);
  await page.goto("/index.html");
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "success",
  );
}

test("troca de mês cancela fetch pendente e mantém valores e período sincronizados", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const original = window.fetch;
    window.abortedMonths = [];
    window.fetch = (url, options) => {
      if (String(url).includes("/expenses?month="))
        options.signal?.addEventListener("abort", () =>
          window.abortedMonths.push(String(url)),
        );
      return original(url, options);
    };
  });
  let received;
  const started = new Promise((resolve) => {
    received = resolve;
  });
  await page.route(BACKEND + "/expenses?month=08%2F2026", async (route) => {
    received();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await respond(route, {
      expenses: [
        {
          id: "old",
          data: "2026-08-01",
          valor: 900,
          usuario: "Paulo Henrique",
          descricao: "Antigo",
          categoria: "Mercado",
          forma_pagamento: "Dinheiro",
        },
      ],
    }).catch(() => {});
  });
  await page.locator("#seletorMes").selectOption("08/2026");
  await started;
  await page.locator("#seletorMes").selectOption("09/2026");
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
  await expect(page.locator("#homePeriod")).toContainText("09/2026");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.abortedMonths.some((url) => url.includes("08%2F2026")),
      ),
    )
    .toBe(true);
  await page.waitForTimeout(300);
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
});

test("erro mensal persiste, oculta dados antigos e permite nova tentativa", async ({
  page,
}) => {
  await ready(page);
  let fail = true;
  await page.route(BACKEND + "/expenses?month=08%2F2026", (route) =>
    respond(
      route,
      fail
        ? { message: "Servidor temporariamente indisponível" }
        : { expenses: [] },
      fail ? 503 : 200,
    ),
  );
  await page.locator("#seletorMes").selectOption("08/2026");
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "error",
  );
  await expect(page.locator("#monthStatus")).toContainText(
    "Servidor temporariamente indisponível",
  );
  await expect(page.locator("#homeHouseTotal")).toBeHidden();
  await expect(page.locator("#authDialog")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBeTruthy();
  fail = false;
  await page.locator("#monthRetry").click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "empty",
  );
  await expect(page.locator("#homeHouseTotal")).toContainText("0,00");
  await expect(page.locator("#homePeriod")).toContainText("08/2026");
});

test("503 na restauração da sessão mantém token e recupera sem redigitar senha", async ({
  page,
}) => {
  await mockBackend(page);
  let fail = true;
  await page.route(BACKEND + "/session", (route) =>
    respond(
      route,
      fail
        ? { message: "Sem conexão com o servidor" }
        : {
            token: "visual-test-token",
            user: { name: "Paulo Henrique", email: "paulo@example.com" },
          },
      fail ? 503 : 200,
    ),
  );
  await page.goto("/index.html");
  await expect(page.locator("#authDialog")).toBeVisible();
  await expect(page.locator("#authConnectionError")).toContainText(
    "Sem conexão",
  );
  await expect(page.locator("#authForm")).toBeHidden();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBe("visual-test-token");
  fail = false;
  await page.locator("#authRetry").click();
  await expect(page.locator("#authDialog")).toHaveCount(0);
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
});

for (const status of [401, 403])
  test(`HTTP ${status} abre login nativo, contém foco e recupera o mês`, async ({
    page,
  }) => {
    await ready(page);
    let invalid = true;
    await page.route(BACKEND + "/session", (route) =>
      respond(route, { message: "Sessão inválida" }, status),
    );
    await page.route(BACKEND + "/expenses?month=08%2F2026", (route) =>
      respond(
        route,
        invalid ? { message: "Entre novamente" } : { expenses: [] },
        invalid ? status : 200,
      ),
    );
    await page.route(BACKEND + "/login", (route) => {
      invalid = false;
      return respond(route, {
        token: "new-token",
        user: { name: "Paulo Henrique", email: "paulo@example.com" },
      });
    });
    await page.locator("#seletorMes").selectOption("08/2026");
    const dialog = page.locator("#authDialog");
    await expect(dialog).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("gastos_pwa_session_token_v2"),
      ),
    ).toBeNull();
    await expect(page.locator("#authEmail")).toBeFocused();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.locator("#authEmail").fill("paulo@example.com");
    await page.locator("#authSenha").fill("senha-valida");
    await page.locator("#authSubmit").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("body")).toHaveAttribute(
      "data-month-state",
      "empty",
    );
    await expect(page.locator("#homePeriod")).toContainText("08/2026");
  });

test("resposta 200 inválida mostra erro persistente e permite recuperar o mês", async ({
  page,
}) => {
  await ready(page);
  let invalid = true;
  await page.route(BACKEND + "/expenses?month=08%2F2026", (route) =>
    respond(route, { expenses: invalid ? { valor: 999 } : [] }),
  );
  await page.locator("#seletorMes").selectOption("08/2026");
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "error",
  );
  await expect(page.locator("#monthStatus")).toContainText("dados inválidos");
  await expect(page.locator("#homeHouseTotal")).toBeHidden();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBeTruthy();
  invalid = false;
  await page.locator("#monthRetry").click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "empty",
  );
});

test("falha no catálogo de meses tenta carregar novamente antes de mostrar valores", async ({
  page,
}) => {
  await mockBackend(page);
  let fail = true;
  await page.route(BACKEND + "/months", (route) =>
    respond(
      route,
      fail
        ? { message: "Meses indisponíveis" }
        : { months: ["09/2026", "08/2026"] },
      fail ? 503 : 200,
    ),
  );
  await page.goto("/index.html");
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "error",
  );
  await expect(page.locator("#monthStatus")).toContainText(
    "Meses indisponíveis",
  );
  fail = false;
  await page.locator("#monthRetry").click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "success",
  );
  await expect(page.locator("#seletorMes")).toHaveValue("09/2026");
  await expect(page.locator("#homePeriod")).toContainText("09/2026");
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
});

test("sessão expirada mantém uma única espera de login para chamadas concorrentes", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route(BACKEND + "/session", (route) =>
    respond(route, { message: "Sessão expirada" }, 401),
  );
  await page.route(BACKEND + "/login", (route) =>
    respond(route, {
      token: "novo",
      user: { name: "Paulo Henrique", email: "paulo@example.com" },
    }),
  );
  await page.goto("/index.html");
  await expect(page.locator("#authEmail")).toBeFocused();
  await page.evaluate(() => {
    window.pendingLoginComplete = false;
    Promise.all([api.ready(), api.ready()]).then(() => {
      window.pendingLoginComplete = true;
    });
  });
  await page.locator("#authEmail").fill("paulo@example.com");
  await page.locator("#authSenha").fill("senha-valida");
  await page.locator("#authSubmit").click();
  await expect(page.locator("#authDialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.pendingLoginComplete))
    .toBe(true);
  await expect(page.locator("body")).toHaveAttribute(
    "data-month-state",
    "success",
  );
  await expect(page.locator("#homeHouseTotal")).toContainText("366");
});
