(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  const conversations = new Map();
  let ctx,
    active = null,
    version = 0,
    walletVersion = 0;
  function context() {
    const value = el("assistantContext").value;
    return {
      scope: value === "house" ? "house" : "wallet",
      month: el("assistantMonth").value,
      ...(value === "house" ? {} : { walletId: value }),
    };
  }
  const key = () => JSON.stringify(context());
  function messages() {
    if (!conversations.has(key())) {
      if (conversations.size >= 20)
        conversations.delete(conversations.keys().next().value);
      conversations.set(key(), []);
    }
    return conversations.get(key());
  }
  function pin() {
    const log = el("assistantMessages");
    return log.scrollHeight - log.scrollTop - log.clientHeight < 100;
  }
  function bottom() {
    const log = el("assistantMessages");
    log.scrollTop = log.scrollHeight;
  }
  function busy(value) {
    el("assistantComposer").querySelector('[type="submit"]').disabled = value;
    el("assistantStop").hidden = !value;
    el("assistantText").readOnly = value;
    el("assistantNew").disabled = value;
    el("assistantComposerStatus").textContent = value
      ? "Preparando uma resposta…"
      : "Você revisa qualquer lançamento antes de salvar.";
  }
  function cancel() {
    version++;
    if (active) {
      active.message.status = "stopped";
      active.controller.abort(
        new DOMException("Resposta interrompida.", "AbortError"),
      );
      active = null;
    }
    busy(false);
  }
  function render() {
    const log = el("assistantMessages");
    log.querySelectorAll(".chat-message").forEach((node) => node.remove());
    const list = messages();
    el("assistantWelcome").hidden = list.length > 0;
    list.forEach((message) => {
      const article = document.createElement("article");
      article.className = "chat-message chat-message--" + message.role;
      article.setAttribute(
        "aria-label",
        message.role === "user" ? "Sua mensagem" : "Resposta do assistente",
      );
      const title = document.createElement("span");
      title.className = "chat-message-author";
      title.textContent = message.role === "user" ? "Você" : "Assistente";
      const text = document.createElement("div");
      text.className = "chat-message-text";
      text.textContent =
        message.content ||
        (message.status === "pending"
          ? "Consultando suas finanças…"
          : message.status === "failed"
            ? "Não foi possível responder."
            : "Resposta interrompida.");
      article.append(title, text);
      message.node = text;
      if (
        message.role === "assistant" &&
        ["failed", "stopped"].includes(message.status)
      ) {
        const status = document.createElement("small");
        status.textContent =
          message.status === "stopped"
            ? "Resposta interrompida"
            : "Resposta incompleta";
        article.appendChild(status);
      }
      if (
        message.role === "user" &&
        /^(?:paguei|gastei|comprei|(?:quero\s+)?(?:registrar|lançar|lancar))\b/i.test(
          message.content,
        ) &&
        /\d/.test(message.content) &&
        !message.content.includes("?") &&
        message.content.length <= 500
      ) {
        const review = document.createElement("button");
        review.type = "button";
        review.className = "btn btn--ghost chat-review";
        review.textContent = "Revisar como gasto";
        const destination = { ...context() };
        review.onclick = async () => {
          review.disabled = true;
          try {
            if (destination.scope === "wallet") {
              window.GastosNavigation.show("carteiras");
              await window.GastosWallets.reviewText(
                message.content,
                destination.walletId,
                destination.month,
              );
            } else {
              window.GastosNavigation.show("lancar");
              await window.GastosSmartEntry.interpretExternal(
                message.content,
                "text",
              );
            }
          } catch (error) {
            window.AppUI.toast(
              error.message || "Não foi possível preparar o gasto.",
              "error",
            );
          } finally {
            review.disabled = false;
          }
        };
        article.appendChild(review);
      }
      log.appendChild(article);
    });
  }
  function history(list, user) {
    const complete = [];
    for (let i = 0; i < list.length - 1; i++) {
      if (
        list[i].role === "user" &&
        list[i + 1].role === "assistant" &&
        list[i + 1].status === "success"
      ) {
        complete.push(
          { role: "user", content: list[i].content },
          { role: "assistant", content: list[i + 1].content },
        );
        i++;
      }
    }
    // Bound both message count and payload size, retaining complete exchanges.
    let result = complete.slice(-20);
    while (
      result.reduce(
        (size, message) => size + message.content.length,
        user.content.length,
      ) > 30000
    )
      result = result.slice(2);
    return [...result, { role: "user", content: user.content }];
  }
  async function send(retry = false) {
    if (
      active ||
      !el("assistantMonth").validity.valid ||
      !el("assistantMonth").value
    )
      return;
    const list = messages();
    let user, answer;
    if (
      retry &&
      list.at(-1)?.role === "assistant" &&
      ["failed", "stopped"].includes(list.at(-1).status)
    ) {
      answer = list.at(-1);
      user = list.at(-2);
      answer.content = "";
      answer.status = "pending";
    } else {
      const content = el("assistantText").value.trim();
      if (!content || content.length > 2000) return;
      user = { role: "user", content };
      answer = { role: "assistant", content: "", status: "pending" };
      list.push(user, answer);
      el("assistantText").value = "";
      if (list.length > 100) list.splice(0, list.length - 100);
    }
    const turn = ++version,
      controller = new AbortController();
    active = { controller, message: answer };
    el("assistantError").hidden = true;
    busy(true);
    render();
    bottom();
    try {
      await ctx.api.streamAssistant(
        { context: context(), messages: history(list, user) },
        {
          signal: controller.signal,
          onEvent(event) {
            if (turn !== version) return;
            if (event.type === "text") {
              const keepBottom = pin();
              answer.content += event.text;
              if (answer.content.length > 12000)
                throw new Error(
                  "A resposta excedeu o limite. Tente uma pergunta mais curta.",
                );
              answer.node.textContent = answer.content;
              el("assistantComposerStatus").textContent =
                "O assistente está respondendo…";
              if (keepBottom) bottom();
            }
          },
        },
      );
      if (!answer.content.trim())
        throw new Error("A IA não retornou texto. Tente novamente.");
      answer.status = "success";
    } catch (error) {
      if (turn !== version) return;
      answer.status = "failed";
      el("assistantErrorMessage").textContent =
        error.message || "Não foi possível responder. Tente novamente.";
      el("assistantConfigure").hidden = ![
        "AI_NOT_CONFIGURED",
        "KEY_REJECTED",
        "MODEL_UNAVAILABLE",
      ].includes(error.code);
      el("assistantRetry").hidden = error.code === "AI_NOT_CONFIGURED";
      el("assistantError").hidden = false;
      render();
    } finally {
      if (turn === version) {
        active = null;
        busy(false);
        el("assistantComposerStatus").textContent =
          answer.status === "success"
            ? "Resposta concluída. Confira os valores antes de decidir."
            : "Sua mensagem foi mantida. Você pode tentar novamente.";
        if (window.GastosNavigation.current() === "assistente")
          el("assistantText").focus({ preventScroll: true });
      }
    }
  }
  async function loadWallets() {
    const turn = ++walletVersion;
    try {
      const wallets = await ctx.api.fetchWallets();
      if (turn !== walletVersion) return;
      const previous = el("assistantContext").value;
      const options = [
        new Option("Casa", "house"),
        ...wallets.map(
          (wallet) => new Option("Cofre · " + wallet.nome, wallet.id),
        ),
      ];
      el("assistantContext").replaceChildren(...options);
      el("assistantContext").value = options.some(
        (option) => option.value === previous,
      )
        ? previous
        : "house";
      if (el("assistantContext").value !== previous) changeContext();
    } catch {
      /* Casa remains usable; wallet errors are handled on their own screen. */
    }
  }
  function changeContext() {
    cancel();
    el("assistantError").hidden = true;
    render();
    bottom();
    el("assistantComposerStatus").textContent =
      "Conversa separada para este período e destino.";
  }
  function monthFromHouse() {
    const [mm, year] = ctx.getSelectedMonth().split("/");
    return year && mm ? year + "-" + mm : new Date().toISOString().slice(0, 7);
  }
  function init(options) {
    ctx = options;
    el("assistantMonth").value = monthFromHouse();
    el("assistantComposer").addEventListener("submit", (event) => {
      event.preventDefault();
      send();
    });
    el("assistantRetry").onclick = () => send(true);
    el("assistantStop").onclick = () => {
      cancel();
      render();
      el("assistantError").hidden = false;
      el("assistantErrorMessage").textContent =
        "Resposta interrompida. Sua mensagem foi mantida.";
      el("assistantConfigure").hidden = true;
      el("assistantRetry").hidden = false;
    };
    el("assistantNew").onclick = () => {
      cancel();
      conversations.delete(key());
      changeContext();
      el("assistantText").focus();
    };
    el("assistantContext").onchange = changeContext;
    el("assistantMonth").onchange = changeContext;
    el("assistantText").addEventListener("keydown", (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing &&
        !window.matchMedia("(pointer: coarse)").matches
      ) {
        event.preventDefault();
        send();
      }
    });
    document.querySelectorAll("[data-chat-prompt]").forEach(
      (button) =>
        (button.onclick = () => {
          el("assistantText").value = button.dataset.chatPrompt;
          send();
        }),
    );
    window.addEventListener("gastos:viewchange", (event) => {
      if (event.detail.view === "assistente") {
        if (!messages().length && el("assistantContext").value === "house")
          el("assistantMonth").value = monthFromHouse();
        render();
        loadWallets();
      } else if (active) {
        cancel();
        render();
      }
    });
    el("seletorMes").addEventListener("change", () => {
      if (el("assistantContext").value === "house") {
        el("assistantMonth").value = monthFromHouse();
        changeContext();
      }
    });
    window.addEventListener("gastos:sessioncleared", () => {
      cancel();
      walletVersion++;
      conversations.clear();
      el("assistantContext").replaceChildren(new Option("Casa", "house"));
      el("assistantText").value = "";
      el("assistantError").hidden = true;
      render();
    });
    if (window.GastosNavigation.current() === "assistente") loadWallets();
  }
  window.GastosAssistant = { init };
})();
