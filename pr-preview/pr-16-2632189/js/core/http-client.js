(function (root) {
  "use strict";

  async function requestJson(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const cancel = () => controller.abort(options.signal.reason);
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener("abort", cancel, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      controller.signal.throwIfAborted();
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      // Keep cancellation and timeout active until the complete body arrives.
      const text = await response.text();
      controller.signal.throwIfAborted();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        if (response.ok) {
          const error = new Error(
            "O servidor retornou uma resposta inválida. Tente novamente.",
          );
          error.code = "INVALID_RESPONSE";
          throw error;
        }
      }
      if (!response.ok) {
        const error = new Error(
          data?.message ||
            `Não foi possível concluir a solicitação (HTTP ${response.status}).`,
        );
        error.status = response.status;
        error.code = data?.error || "BACKEND_ERROR";
        error.details = data?.details;
        throw error;
      }
      return data;
    } catch (cause) {
      if (options.signal?.aborted)
        throw (
          options.signal.reason ||
          new DOMException("Consulta cancelada.", "AbortError")
        );
      if (timedOut || cause instanceof TypeError) {
        const error = new Error(
          timedOut
            ? "O servidor demorou para responder. Tente novamente."
            : "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
        );
        error.code = timedOut ? "REQUEST_TIMEOUT" : "NETWORK_ERROR";
        error.cause = cause;
        throw error;
      }
      throw cause;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
    }
  }
  root.GastosHttp = Object.freeze({ requestJson });
})(globalThis);
