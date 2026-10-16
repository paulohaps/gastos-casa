import "../../js/core/event-stream.js";

export async function streamAssistant(
  config,
  instruction,
  messages,
  { signal, onText, fetchImpl = fetch },
) {
  let url, headers, body;
  if (config.provider === "gemini") {
    url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(config.model) +
      ":streamGenerateContent?alt=sse";
    headers = {
      "content-type": "application/json",
      "x-goog-api-key": config.apiKey,
    };
    body = {
      systemInstruction: { parts: [{ text: instruction }] },
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: 1200, temperature: 0.2 },
    };
  } else if (config.provider === "deepseek") {
    url = "https://api.deepseek.com/chat/completions";
    headers = {
      "content-type": "application/json",
      authorization: "Bearer " + config.apiKey,
    };
    body = {
      model: config.model,
      stream: true,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [{ role: "system", content: instruction }, ...messages],
    };
  } else throw new Error("INVALID_CONFIG");
  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(
      [401, 403].includes(response.status)
        ? "KEY_REJECTED"
        : response.status === 429
          ? "PROVIDER_LIMIT"
          : [400, 404].includes(response.status)
            ? "MODEL_UNAVAILABLE"
            : "PROVIDER_UNAVAILABLE",
    );
  let length = 0,
    finished = false;
  await globalThis.GastosEventStream.consume(
    response,
    async (event) => {
      if (event.error) throw new Error("PROVIDER_UNAVAILABLE");
      const reason =
        config.provider === "gemini"
          ? event.candidates?.[0]?.finishReason
          : event.choices?.[0]?.finish_reason;
      if (reason) finished = true;
      const text =
        config.provider === "gemini"
          ? event.candidates?.[0]?.content?.parts
              ?.filter((part) => !part.thought)
              .map((part) => part.text || "")
              .join("")
          : event.choices?.[0]?.delta?.content;
      if (typeof text !== "string" || !text) return;
      length += text.length;
      if (length > 12000) throw new Error("STREAM_TOO_LARGE");
      await onText(text);
    },
    signal,
  );
  if (!length) throw new Error("EMPTY_RESPONSE");
  if (!finished) throw new Error("INCOMPLETE_RESPONSE");
}
