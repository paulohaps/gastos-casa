import { test, expect } from "@playwright/test";
import { BACKEND, mockBackend } from "./helpers/mock-backend.mjs";
import { AI_PROVIDERS } from "../backend/services/ai-settings.mjs";
const connection = (settings = null, storageReady = true) => ({
  providers: AI_PROVIDERS,
  settings,
  storageReady,
});
async function open(page, handler, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await mockBackend(page);
  await page.route(
    BACKEND + "/ai/settings",
    handler || ((route) => route.fulfill({ json: connection() })),
  );
  await page.goto("/index.html#ajustes");
  await page.locator("#settingsIntegrations > summary").click();
  await page.locator("#settingsAdvanced > summary").click();
}
test("erro de configuração tem retry, preserva sessão e bloqueia salvar dados incompletos", async ({
  page,
}) => {
  let failed = true;
  await open(page, (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { message: "Conexão indisponível" },
        })
      : route.fulfill({ json: connection() }),
  );
  await expect(page.locator("#aiSettingsStatus")).toContainText("indisponível");
  await expect(page.locator("#aiSave")).toBeDisabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBeTruthy();
  failed = false;
  await page
    .locator("#aiSettingsForm")
    .getByRole("button", { name: "Tentar novamente" })
    .click();
  await expect(page.locator("#aiModel")).toHaveValue(
    AI_PROVIDERS[0].models[0].id,
  );
  await expect(page.locator("#aiSave")).toBeEnabled();
});
test("contrato inválido de IA é rejeitado e pode ser carregado novamente", async ({
  page,
}) => {
  let invalid = true;
  await open(page, (route) =>
    route.fulfill({
      json: invalid
        ? { providers: {}, settings: null, storageReady: true }
        : connection(),
    }),
  );
  await expect(page.locator("#aiSettingsStatus")).toContainText("incompleta");
  await expect(page.locator("#aiTest")).toBeDisabled();
  invalid = false;
  await page
    .locator("#aiSettingsForm")
    .getByRole("button", { name: "Tentar novamente" })
    .click();
  await expect(page.locator("#aiTest")).toBeEnabled();
});
test("armazenamento indisponível mantém ações desabilitadas e não envia chave", async ({
  page,
}) => {
  const writes = [];
  await open(page, (route) => {
    if (route.request().method() === "POST")
      writes.push(route.request().postDataJSON());
    return route.fulfill({ json: connection(null, false) });
  });
  await expect(page.locator("#aiSettingsStatus")).toContainText(
    "não está disponível",
  );
  for (const id of ["aiSave", "aiTest", "aiApiKey"])
    await expect(page.locator("#" + id)).toBeDisabled();
  await page.evaluate(() =>
    document.getElementById("aiSettingsForm").requestSubmit(),
  );
  expect(writes).toEqual([]);
});
test("remover chave após mudança de sessão não executa a solicitação anterior", async ({
  page,
}) => {
  const writes = [];
  await open(page, (route) => {
    if (route.request().method() === "POST")
      writes.push(route.request().postDataJSON());
    return route.fulfill({
      json: connection({
        provider: "gemini",
        model: AI_PROVIDERS[0].models[0].id,
        hasKey: true,
      }),
    });
  });
  await page.locator("#aiRemove").click();
  await expect(page.locator("#confirmDialog")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("gastos:sessioncleared")),
  );
  await page.locator("#confirmAccept").click();
  await expect(page.locator("#aiConnectionBadge")).toHaveText("Não conectada");
  expect(writes).toEqual([]);
});
test("falha ao salvar IA permite retry sem duplicação e limpa segredo ao sair", async ({
  page,
}) => {
  let failed = true,
    writes = 0;
  await open(page, (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: connection() });
    writes++;
    return failed
      ? route.fulfill({
          status: 503,
          json: { message: "Salvamento indisponível" },
        })
      : route.fulfill({
          json: {
            settings: {
              provider: "gemini",
              model: AI_PROVIDERS[0].models[0].id,
              hasKey: true,
            },
          },
        });
  });
  await page.locator("#aiApiKey").fill("fake-secret-for-settings");
  await page.locator("#aiSave").click();
  await expect(page.locator("#aiSettingsStatus")).toContainText("indisponível");
  await expect(page.locator("#aiApiKey")).toHaveValue(
    "fake-secret-for-settings",
  );
  failed = false;
  await page.locator("#aiSave").click();
  await expect(page.locator("#aiApiKey")).toHaveValue("");
  expect(writes).toBe(2);
  await page.locator("#aiApiKey").fill("another-secret");
  await page.evaluate(() => GastosNavigation.show("resumo"));
  await expect(page.locator("#aiApiKey")).toHaveValue("");
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((v) =>
        /fake-secret|another-secret/.test(v),
      ),
    ),
  ).toBe(false);
});
test("cadastro de usuário tem foco, erro recuperável e limpa senha ao sair", async ({
  page,
}) => {
  await mockBackend(page);
  let failed = true,
    writes = 0;
  await page.route(BACKEND + "/members", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          members: [{ nome: "Ana", email: "ana@example.com", ativo: true }],
        },
      });
    writes++;
    return failed
      ? route.fulfill({
          status: 503,
          json: { message: "Cadastro indisponível" },
        })
      : route.fulfill({ json: { ok: true } });
  });
  await page.goto("/index.html#ajustes");
  await page.locator("#settingsIntegrations > summary").click();
  await page.locator("#settingsAdvanced > summary").click();
  await expect(page.locator("#listaMembros")).toContainText("Ana");
  await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
  await expect(page.locator("#membroNome")).toBeFocused();
  await page.locator("#membroNome").fill("Joana");
  await page.locator("#membroEmail").fill("joana@example.com");
  await page.locator("#membroSenha").fill("fake-password123");
  await page.locator("#formMembro [type=submit]").click();
  await expect(page.getByRole("alert")).toContainText("Cadastro indisponível");
  await expect(page.locator("#membroNome")).toHaveValue("Joana");
  failed = false;
  await page.locator("#formMembro [type=submit]").click();
  await expect(page.locator("#formMembro")).toBeHidden();
  expect(writes).toBe(2);
  await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
  await page.locator("#membroSenha").fill("private-draft");
  await page.evaluate(() => GastosNavigation.show("resumo"));
  await expect(page.locator("#membroSenha")).toHaveValue("");
});
test("lista de usuários atrasada não reaparece depois de limpar sessão", async ({
  page,
}) => {
  await mockBackend(page);
  let release;
  await page.route(BACKEND + "/members", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      json: {
        members: [
          { nome: "Usuário antigo", email: "old@example.com", ativo: true },
        ],
      },
    });
  });
  await page.goto("/index.html#ajustes");
  await page.locator("#settingsIntegrations > summary").click();
  await page.locator("#settingsAdvanced > summary").click();
  await expect.poll(() => typeof release).toBe("function");
  const completed = page.waitForResponse(BACKEND + "/members");
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("gastos:sessioncleared")),
  );
  release();
  await (await completed).finished();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(page.locator("#listaMembros")).not.toContainText(
    "Usuário antigo",
  );
});
for (const width of [320, 390, 1920])
  test("ajustes e formulário contidos em " + width, async ({ page }) => {
    await open(page, undefined, width);
    await expect(page.locator("#aiSave")).toBeEnabled();
    await page
      .getByRole("button", { name: "Novo usuário", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(page.locator("#membroNome")).toBeFocused();
    if (width === 390)
      await page.screenshot({
        path: "test-results/settings-react-390.png",
        fullPage: true,
      });
  });

test("aprendizado React mantém prioridade manual, cria regra e confirma exclusão", async ({
  page,
}) => {
  await mockBackend(page);
  let rules = [
    {
      id: "posto",
      termo_normalizado: "posto",
      categoria: "Contas",
      confirmacoes: 1,
      manual: true,
      ativo: true,
    },
    {
      id: "posto",
      termo_normalizado: "posto",
      categoria: "Outros",
      confirmacoes: 8,
      manual: false,
      ativo: true,
    },
  ];
  const writes = [];
  await page.route(BACKEND + "/smart-entry/rules", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { rules } });
    const data = route.request().postDataJSON();
    writes.push(data);
    if (data.action === "delete-term")
      rules = rules.filter((rule) => rule.termo_normalizado !== data.term);
    else
      rules = [
        ...rules.filter((rule) => rule.termo_normalizado !== data.term),
        {
          id: data.term,
          termo_normalizado: data.term,
          categoria: data.category,
          confirmacoes: 0,
          manual: true,
          ativo: true,
        },
      ];
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/index.html#ajustes");
  await page.locator("#settingsIntegrations > summary").click();
  await page.locator("#settingsAdvanced > summary").click();
  await expect(page.locator("#listaSmartRules .smart-rule-item")).toHaveCount(
    1,
  );
  await expect(
    page.getByLabel("Categoria para posto", { exact: true }),
  ).toHaveValue("Contas");
  await expect(page.locator("#listaSmartRules")).toContainText("Manual");
  await page.getByRole("button", { name: "Nova regra", exact: true }).click();
  await expect(page.locator("#smartRuleTermo")).toBeFocused();
  await page.locator("#smartRuleTermo").fill("farmacia");
  await page.locator("#smartRuleCategoria").selectOption("Outros");
  await page.locator("#formSmartRule [type=submit]").click();
  await expect(
    page.getByLabel("Categoria para farmacia", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir aprendizado de farmacia" })
    .click();
  await page.locator("#confirmCancel").click();
  expect(writes.filter((data) => data.action === "delete-term")).toHaveLength(
    0,
  );
  await page
    .getByLabel("Categoria para posto", { exact: true })
    .selectOption("Mercado");
  await page
    .getByRole("button", { name: "Fixar categoria para posto" })
    .click();
  await expect(
    page.getByLabel("Categoria para posto", { exact: true }),
  ).toHaveValue("Mercado");
  await page
    .getByRole("button", { name: "Excluir aprendizado de farmacia" })
    .click();
  await page.locator("#confirmAccept").click();
  await expect(
    page.getByLabel("Categoria para farmacia", { exact: true }),
  ).toHaveCount(0);
});
test("regras inválidas mostram erro recuperável e não reaparecem após trocar sessão", async ({
  page,
}) => {
  await mockBackend(page);
  let invalid = true,
    release;
  await page.route(BACKEND + "/smart-entry/rules", async (route) => {
    if (invalid)
      return route.fulfill({
        json: {
          rules: [
            {
              id: "antigo",
              termo_normalizado: "antigo",
              categoria: "categoria inválida",
              confirmacoes: 3,
            },
          ],
        },
      });
    await new Promise((resolve) => {
      release = resolve;
    });
    return route.fulfill({
      json: {
        rules: [
          {
            id: "antigo",
            termo_normalizado: "antigo",
            categoria: "Mercado",
            confirmacoes: 3,
          },
        ],
      },
    });
  });
  await page.goto("/index.html#ajustes");
  await page.locator("#settingsIntegrations > summary").click();
  await page.locator("#settingsAdvanced > summary").click();
  await expect(
    page.locator(".smart-rules-settings [role=alert]"),
  ).toContainText("Regra inválida");
  invalid = false;
  await page
    .locator(".smart-rules-settings")
    .getByRole("button", { name: "Tentar novamente" })
    .click();
  await expect.poll(() => typeof release).toBe("function");
  const completed = page.waitForResponse(BACKEND + "/smart-entry/rules");
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("gastos:sessioncleared")),
  );
  release();
  await (await completed).finished();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(page.locator("#listaSmartRules")).not.toContainText("antigo");
});

test("qualidade fica recolhida, descarta período atrasado e mantém retry após 503", async ({
  page,
}) => {
  await mockBackend(page);
  let first;
  await page.route(BACKEND + "/smart-entry/metrics?**", async (route) => {
    const days = Number(
      new URL(route.request().url()).searchParams.get("days"),
    );
    if (days === 30) return route.fallback();
    if (days === 7) {
      await new Promise((resolve) => {
        first = resolve;
      });
      return route
        .fulfill({ json: { metrics: { interpretations: 999 } } })
        .catch(() => {});
    }
    return route.fulfill({
      status: 503,
      json: { message: "Qualidade indisponível" },
    });
  });
  await page.goto("/index.html#ajustes");
  await page.locator("#settingsIntegrations > summary").click();
  await page.locator("#settingsAdvanced > summary").click();
  await expect(page.locator("#smartMetricInterpretacoes")).toHaveText("12");
  await expect(page.locator("#settingsQuality")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.locator("#settingsQuality > summary").click();
  await page.locator("#smartMetricsDays").selectOption("7");
  await expect.poll(() => typeof first).toBe("function");
  await page.locator("#smartMetricsDays").selectOption("90");
  await expect(page.locator("#settingsQuality [role=alert]")).toContainText(
    "indisponível",
  );
  first();
  await expect(page.locator("#smartMetricInterpretacoes")).toHaveText("—");
  await expect(page.locator("#smartMetricSemCorrecao")).toHaveText("—");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBeTruthy();
  await page.locator("#smartMetricsDays").selectOption("30");
  await expect(page.locator("#smartMetricInterpretacoes")).toHaveText("12");
});
