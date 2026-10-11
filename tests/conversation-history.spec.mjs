import { test, expect } from "@playwright/test";
import { BACKEND, mockBackend } from "./helpers/mock-backend.mjs";
const id = "44444444-4444-4444-8444-444444444444";
async function setup(page, initial = null) {
  await mockBackend(page);
  let saved = initial;
  await page.route(BACKEND + "/assistant/conversation**", (route) => {
    const context = new URL(route.request().url()).searchParams;
    if (route.request().method() === "DELETE") saved = null;
    return route.fulfill({
      json: {
        conversation:
          context.get("month") === "2026-09" && context.get("scope") === "house"
            ? saved
            : null,
      },
    });
  });
  await page.route(BACKEND + "/assistant/chat", (route) => {
    const payload = route.request().postDataJSON();
    saved = {
      id,
      revision: (saved?.revision ?? 0) + 1,
      messages: [
        ...(saved?.messages ?? []),
        payload.messages.at(-1),
        { role: "assistant", content: "Resposta persistida no servidor." },
      ],
    };
    return route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "start", conversation: { id, revision: saved.revision - 1 } },
        { type: "text", text: "Resposta persistida no servidor." },
        { type: "end", conversation: { id, revision: saved.revision } },
      ]
        .map((event) => "data: " + JSON.stringify(event) + "\n\n")
        .join(""),
    });
  });
  await page.goto("/index.html#assistente");
  await expect(page.locator("#assistantComposer [type=submit]")).toBeEnabled();
}
test("histórico retoma após reload, sai do contexto correto e não usa localStorage para mensagens", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#assistantText").fill("Pergunta privada persistida");
  await page.locator("#assistantComposer [type=submit]").click();
  await expect(page.locator("#assistantComposerStatus")).toContainText(
    "Resposta concluída",
  );
  await page.reload();
  await expect(page.locator(".chat-message--user")).toHaveText(
    /Pergunta privada persistida/,
  );
  await expect(page.locator(".chat-message--assistant")).toContainText(
    "Resposta persistida",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "Pergunta privada persistida",
  );
  await page.locator("#assistantMonth").fill("2026-08");
  await expect(page.locator(".chat-message")).toHaveCount(0);
});
test("nova conversa confirma exclusão no dialog, contém foco e não volta após reload", async ({
  page,
}) => {
  await setup(page, {
    id,
    revision: 3,
    messages: [
      { role: "user", content: "Privado" },
      { role: "assistant", content: "Resposta" },
    ],
  });
  await page.locator("#assistantNew").click();
  const dialog = page.getByRole("dialog", {
    name: "Começar uma nova conversa?",
  });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Manter conversa" }).click();
  await expect(page.locator(".chat-message")).toHaveCount(2);
  await page.locator("#assistantNew").click();
  await page.getByRole("button", { name: "Excluir e começar" }).click();
  await expect(page.locator(".chat-message")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#assistantWelcome")).toBeVisible();
});
test("falha 503 ou contrato inválido ao retomar bloqueia envio e permite recuperar sem perder sessão", async ({
  page,
}) => {
  await mockBackend(page);
  let call = 0;
  await page.route(BACKEND + "/assistant/conversation**", (route) => {
    call++;
    return call === 1
      ? route.fulfill({
          status: 503,
          json: { message: "Histórico indisponível" },
        })
      : call === 2
        ? route.fulfill({
            json: { conversation: { id, revision: 0, messages: {} } },
          })
        : route.fulfill({ json: { conversation: null } });
  });
  await page.goto("/index.html#assistente");
  await expect(page.locator("#assistantError")).toContainText(
    "Histórico indisponível",
  );
  await expect(page.locator("#assistantComposer [type=submit]")).toBeDisabled();
  await page.getByRole("button", { name: "Recarregar histórico" }).click();
  await expect(page.locator("#assistantError")).toContainText("incompleto");
  await page.getByRole("button", { name: "Recarregar histórico" }).click();
  await expect(page.locator("#assistantComposer [type=submit]")).toBeEnabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gastos_pwa_session_token_v2"),
    ),
  ).toBeTruthy();
});
test("histórico atrasado não expõe mensagens após mudança de sessão", async ({
  page,
}) => {
  await mockBackend(page);
  let release;
  await page.route(BACKEND + "/assistant/conversation**", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({
        json: {
          conversation: {
            id,
            revision: 1,
            messages: [
              { role: "user", content: "Segredo da sessão anterior" },
              { role: "assistant", content: "Resposta privada" },
            ],
          },
        },
      })
      .catch(() => {});
  });
  await page.goto("/index.html#assistente");
  await expect.poll(() => typeof release).toBe("function");
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("gastos:sessioncleared")),
  );
  release();
  await expect(page.locator(".chat-message")).toHaveCount(0);
  await expect(page.locator("#assistantComposer [type=submit]")).toBeDisabled();
});
test("falha de exclusão preserva conversa e conflito entre abas exige recarregar", async ({
  page,
}) => {
  const conversation = {
    id,
    revision: 1,
    messages: [
      { role: "user", content: "Mensagem mantida" },
      { role: "assistant", content: "Resposta mantida" },
    ],
  };
  await setup(page, conversation);
  await page.route(BACKEND + "/assistant/conversation**", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 503,
          json: { message: "Não foi possível excluir" },
        })
      : route.fulfill({ json: { conversation } }),
  );
  await page.locator("#assistantNew").click();
  await page.getByRole("button", { name: "Excluir e começar" }).click();
  await expect(page.locator("#assistantError")).toContainText(
    "Não foi possível excluir",
  );
  await expect(page.locator(".chat-message")).toHaveCount(2);
  await page.route(BACKEND + "/assistant/chat", (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: "HISTORY_CONFLICT",
        message: "Conversa mudou em outra aba",
      },
    }),
  );
  await page.locator("#assistantText").fill("Outra pergunta");
  await page.locator("#assistantComposer [type=submit]").click();
  await expect(
    page.getByRole("button", { name: "Recarregar histórico" }),
  ).toBeVisible();
  await expect(page.locator("#assistantComposer [type=submit]")).toBeDisabled();
  await page.getByRole("button", { name: "Recarregar histórico" }).click();
  await expect(page.locator(".chat-message")).toHaveCount(2);
});
