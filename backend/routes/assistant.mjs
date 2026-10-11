export const ASSISTANT_ERRORS = {
  INVALID_CONTEXT: [400, "Escolha um período e uma carteira válidos."],
  INVALID_MESSAGES: [400, "Revise o tamanho e a sequência das mensagens."],
  INVALID_OWNER: [403, "Sua identidade não permite acesso ao assistente."],
  WALLET_NOT_FOUND: [404, "Esta carteira não está disponível para você."],
  AI_NOT_CONFIGURED: [
    409,
    "Conecte Gemini ou DeepSeek em Ajustes para conversar.",
  ],
  COOLDOWN: [429, "Aguarde um instante antes de enviar novamente."],
  KEY_REJECTED: [400, "A IA recusou sua chave. Confira a conexão em Ajustes."],
  PROVIDER_LIMIT: [
    429,
    "O limite do provedor foi atingido. Confira sua conta de IA.",
  ],
  MODEL_UNAVAILABLE: [
    400,
    "Este modelo está indisponível. Escolha outro em Ajustes.",
  ],
  DATA_UNAVAILABLE: [
    503,
    "Não foi possível consultar suas finanças. Tente novamente.",
  ],
  INCOMPLETE_RESPONSE: [
    503,
    "A resposta foi interrompida pelo provedor. Tente novamente.",
  ],
  STORAGE_UNAVAILABLE: [
    503,
    "Não foi possível consultar sua conexão de IA. Tente novamente.",
  ],
  PROVIDER_UNAVAILABLE: [503, "A IA não respondeu. Tente novamente."],
  EMPTY_RESPONSE: [503, "A IA retornou uma resposta vazia. Tente novamente."],
};
export function assistantFailure(error) {
  const code = Object.hasOwn(ASSISTANT_ERRORS, error?.message)
    ? error.message
    : "PROVIDER_UNAVAILABLE";
  return {
    code,
    status: ASSISTANT_ERRORS[code][0],
    message: ASSISTANT_ERRORS[code][1],
  };
}
export function createAssistantRouter({
  requireAuth,
  readJson,
  json,
  corsHeaders,
  service,
}) {
  return async (req, url) => {
    if (url.pathname !== "/assistant/chat") return null;
    if (req.method !== "POST")
      return json(req, 405, { message: "Use POST para enviar uma mensagem." });
    const { auth, error } = await requireAuth(req, true);
    if (error) return error;
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.signal.addEventListener("abort", abort, { once: true });
    if (req.signal.aborted) abort();
    const timer = setTimeout(abort, 45000);
    let heartbeat;
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      req.signal.removeEventListener("abort", abort);
    };
    let prepared;
    try {
      prepared = await service.prepare(
        auth.user.id,
        auth.jwt,
        await readJson(req),
        controller.signal,
      );
    } catch (cause) {
      cleanup();
      const failure = assistantFailure(cause);
      return json(req, failure.status, failure);
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(output) {
        const emit = (event) => {
          if (!controller.signal.aborted)
            output.enqueue(
              encoder.encode("data: " + JSON.stringify(event) + "\n\n"),
            );
        };
        try {
          emit({
            type: "start",
            context: prepared.context,
            provider: prepared.config.provider,
            model: prepared.config.model,
          });
          heartbeat = setInterval(() => {
            if (!controller.signal.aborted) {
              try {
                output.enqueue(encoder.encode(": heartbeat\n\n"));
              } catch {
                controller.abort();
              }
            }
          }, 10000);
          await prepared.stream({
            signal: controller.signal,
            onText: (text) => emit({ type: "text", text }),
          });
          controller.signal.throwIfAborted();
          emit({ type: "end", token: auth.token });
        } catch (cause) {
          if (!req.signal.aborted) {
            const failure = assistantFailure(cause);
            try {
              output.enqueue(
                encoder.encode(
                  "data: " +
                    JSON.stringify({
                      type: "error",
                      code: failure.code,
                      message: failure.message,
                    }) +
                    "\n\n",
                ),
              );
            } catch {}
          }
        } finally {
          cleanup();
          prepared.release();
          try {
            output.close();
          } catch {}
        }
      },
      cancel() {
        controller.abort();
        cleanup();
        prepared.release();
      },
    });
    return new Response(stream, {
      headers: {
        ...corsHeaders(req),
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    });
  };
}
