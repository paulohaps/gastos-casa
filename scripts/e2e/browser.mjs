import { chromium, expect as baseExpect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { state, call, status, track, save } from "./client.mjs";
const expect = baseExpect.configure({ timeout: 30000 });
import {
  reportRoot as root,
  siteUrl as base,
  browserProxy as proxy,
  staticPreview,
  login,
  nav,
} from "./browser-support.mjs";
const checks = [];
await mkdir(root, { recursive: true });
async function check(label, body) {
  console.log("RUN: " + label);
  await body();
  checks.push(label);
  console.log("PASS: " + label);
  await writeFile(
    root + "/browser-progress.json",
    JSON.stringify(
      { checks, provider: "contract-stub", productionWrites: false },
      null,
      2,
    ),
  );
}
async function recordBrowserResources() {
  const data = status(
    await call(
      "ph",
      "/expenses?month=" + encodeURIComponent(state.fixture.month),
    ),
    200,
    "track browser expenses",
  );
  for (const row of data.expenses.filter((r) =>
    r.descricao.includes(state.fixture.runId),
  ))
    await track(
      "shared",
      row.id,
      row.usuario === "Fernando Gustavo" ? "fg" : "ph",
    );
  const payments = status(
    await call(
      "ph",
      "/settlements?month=" + encodeURIComponent(state.fixture.month),
    ),
    200,
    "track browser payments",
  );
  for (const row of payments.settlements.filter((r) =>
    (r.observacao || "").includes(state.fixture.runId),
  ))
    await track("payments", row.id, "ph");
  const own = status(
    await call(
      "ph",
      "/wallets/expenses?walletId=" +
        state.fixture.walletId +
        "&month=" +
        state.fixture.iso,
    ),
    200,
    "track browser private",
  );
  for (const row of own.expenses.filter((r) =>
    r.descricao.includes(state.fixture.runId),
  ))
    await track("personal", row.id, "ph");
}
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  proxy,
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await staticPreview(context);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await check(
    "Native login, focus containment and exact shared balances",
    async () => {
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#authForm")).toBeVisible();
      await page.locator("#authEmail").focus();
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        expect(
          await page
            .locator("#authDialog")
            .evaluate((d) => d.contains(document.activeElement)),
        ).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(page.locator("#authDialog")).toBeVisible();
      await login(page, "ph");
      await expect(page.locator("#homePayable")).toContainText("40,00");
      await expect(page.locator("#homeReceivable")).toContainText("30,00");
      await expect(page.locator(".balance-summary--unavailable")).toHaveCount(
        0,
      );
    },
  );
  await check(
    "Mobile entry is compact; Casa/Pessoal remain accessible in filters",
    async () => {
      await expect(page.locator(".workspace-switch")).toHaveCount(0);
      const action = page.locator(".quick-expense-fab");
      await expect(action).toHaveCount(1);
      expect((await action.boundingBox()).y).toBeLessThan(200);
      await page.getByRole("button", { name: "Filtros", exact: true }).click();
      const panel = page.locator("#dashboardFiltersDialog");
      await expect(panel).toBeVisible();
      await panel.getByLabel("Tipo de gasto").selectOption("personal");
      await panel.getByRole("button", { name: /Aplicar/ }).click();
      await expect(page.locator("#homeHouseTotal")).toContainText("25,00");
      await page.getByRole("button", { name: /^Filtros/ }).click();
      await panel.getByLabel("Tipo de gasto").selectOption("house");
      await panel.getByRole("button", { name: /Aplicar/ }).click();
      await expect(page.locator("#homeHouseTotal")).toContainText("360,00");
      await page.screenshot({
        path: root + "/native-mobile-home.png",
        fullPage: true,
      });
    },
  );
  const description = "QA navegador " + state.fixture.runId;
  await check(
    "Manual expense saved through the real frontend and persisted after reload",
    async () => {
      await page.locator(".quick-expense-fab").click();
      await page.locator('[data-entry-target="lancar"]').click();
      await page.locator("#inputData").fill(state.fixture.iso + "-15");
      await page.locator("#inputValor").fill("25");
      await page.locator("#inputDescricao").fill(description);
      await page.locator("#inputCategoria").selectOption("Mercado");
      await page.locator("#inputFormaPagamento").selectOption("Dinheiro");
      const saved = page.waitForResponse(
        (r) =>
          r.url() === state.config.backendUrl + "/expenses" &&
          r.request().method() === "POST",
      );
      await page.locator("#btnSubmit").click();
      expect((await saved).status()).toBe(200);
      await recordBrowserResources();
      await nav(page, "resumo");
      await expect(page.locator("#homeHouseTotal")).toContainText("385,00");
      await page.reload();
      await page.locator("#seletorMes").selectOption(state.fixture.month);
      await expect(page.locator("#homeHouseTotal")).toContainText("385,00");
    },
  );
  await check(
    "Editing and deleting a synthetic expense preserve financial totals",
    async () => {
      await nav(page, "casa");
      await page.locator('[data-house-tab="despesas"]').click();
      const row = page
        .locator(".history-card tr")
        .filter({ hasText: description });
      await row.locator('button[title="Editar"]').click();
      await page.locator("#inputValor").fill("27.50");
      const edited = page.waitForResponse(
        (r) =>
          r.url() === state.config.backendUrl + "/expenses" &&
          r.request().method() === "POST",
      );
      await page.locator("#btnSubmit").click();
      expect((await edited).status()).toBe(200);
      await nav(page, "resumo");
      await expect(page.locator("#homeHouseTotal")).toContainText("387,50");
      await nav(page, "casa");
      await page.locator('[data-house-tab="despesas"]').click();
      await row.locator('button[title="Apagar"]').click();
      await page
        .locator("#confirmDialog")
        .getByRole("button", { name: /Confirmar|Excluir/ })
        .click();
      await expect(row).toHaveCount(0);
      await nav(page, "resumo");
      await expect(page.locator("#homeHouseTotal")).toContainText("360,00");
    },
  );
  await check(
    "Settlement reduces the selected debt without adding expenses",
    async () => {
      await nav(page, "casa");
      await page.locator('[data-house-tab="acertos"]').click();
      await page
        .locator("#boxAcertoDinheiro")
        .getByRole("button", { name: "Registrar pagamento", exact: true })
        .click();
      await page.locator("#settlementAmount").fill("5");
      await page.locator("#settlementDate").fill(state.fixture.iso + "-21");
      await page
        .locator("#settlementNote")
        .fill("QA navegador " + state.fixture.runId);
      await page.locator("#settlementSubmit").click();
      await expect(page.locator("#settlementDialog")).not.toBeVisible();
      await recordBrowserResources();
      await nav(page, "resumo");
      await expect(page.locator("#homePayable")).toContainText("35,00");
      await expect(page.locator("#homeReceivable")).toContainText("30,00");
      await expect(page.locator("#homeHouseTotal")).toContainText("360,00");
    },
  );
  await check(
    "Private wallet form, budget and expense persistence",
    async () => {
      await nav(page, "carteiras");
      await page.locator("#walletMonth").fill(state.fixture.iso);
      await expect(page.locator("#walletSpent")).toContainText("25,00");
      await page.locator("#walletAddExpense").click();
      await page.locator("#walletExpenseDate").fill(state.fixture.iso + "-16");
      await page.locator("#walletExpenseValue").fill("3.50");
      await page
        .locator("#walletExpenseDescription")
        .fill("QA privado navegador " + state.fixture.runId);
      await page.locator("#walletExpenseCategory").selectOption("Outros");
      await page.locator("#walletExpenseSubmit").click();
      await expect(page.locator("#walletExpenseDialog")).not.toBeVisible();
      await expect(page.locator("#walletSpent")).toContainText("28,50");
      await expect(page.locator("#walletRemaining")).toContainText("971,50");
      await recordBrowserResources();
    },
  );
  await check(
    "Assistant reads native debts, streams a provider contract and resumes saved history",
    async () => {
      await nav(page, "assistente");
      await page.locator("#assistantContext").selectOption("house");
      await page.locator("#assistantMonth").fill(state.fixture.iso);
      await page.locator("#assistantText").fill("Quanto devo a Fernando?");
      await page.locator('#assistantComposer [type="submit"]').click();
      await expect(page.locator("#assistantMessages")).toContainText(
        "provedor simulado",
      );
      await expect(page.locator("#assistantMessages")).toContainText("35,00");
      await expect(page.locator(".chat-table")).toContainText("Dinheiro");
      await expect(page.locator(".chat-table")).toContainText("Vale");
      await expect(page.locator("#assistantMessages")).toContainText(
        "expense-intelligence-v1",
      );
      await page.reload();
      await page.locator("#assistantMonth").fill(state.fixture.iso);
      await expect(page.locator("#assistantMessages")).toContainText(
        "provedor simulado",
      );
      await expect(page.locator("#assistantMessages")).toContainText("35,00");
      await page.screenshot({
        path: root + "/native-chat-contract.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Assistant exit and logout preserve navigation and login focus",
    async () => {
      await page.locator('[data-app-nav="resumo"]:visible').first().click();
      await expect(page.locator("#homeTitle")).toBeVisible();
      await page.getByLabel("Menu da conta", { exact: true }).click();
      await page.getByRole("button", { name: "Sair", exact: true }).click();
      await expect(page.locator("#authForm")).toBeVisible();
      await expect(page.locator("#authEmail")).toBeFocused();
      expect(
        await page.evaluate(() =>
          localStorage.getItem("gastos_pwa_session_token_v2"),
        ),
      ).toBe("production-session-must-remain");
    },
  );
  expect(errors).toEqual([]);
  await context.close();
  const fgContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  await staticPreview(fgContext);
  const fg = await fgContext.newPage();
  fg.setDefaultTimeout(30000);
  await check(
    "Gemini adapter, opposite debt direction and private wallet isolation in the browser",
    async () => {
      await login(fg, "fg");
      await expect(fg.locator("#homePayable")).toContainText("30,00");
      await expect(fg.locator("#homeReceivable")).toContainText("35,00");
      await nav(fg, "carteiras");
      await expect(fg.locator("#walletEmptyView")).toBeVisible();
      await nav(fg, "assistente");
      await fg.locator("#assistantMonth").fill(state.fixture.iso);
      await fg.locator("#assistantText").fill("Quem deve a quem?");
      await fg.locator('#assistantComposer [type="submit"]').click();
      await expect(fg.locator("#assistantMessages")).toContainText(
        "provedor simulado",
      );
      await expect(fg.locator("#assistantMessages")).toContainText("30,00");
      await expect(fg.locator("#assistantMessages")).toContainText("35,00");
    },
  );
  await fgContext.close();
  await writeFile(
    root + "/browser-native.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        nativeAuth: true,
        nativeDataApi: true,
        nativeRls: true,
        provider: "contract-stub",
        realProviderCalled: false,
        productionWrites: false,
      },
      null,
      2,
    ),
  );
} finally {
  await recordBrowserResources().catch(() => {});
  await save();
  await browser.close();
}
