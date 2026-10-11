import test from "node:test";
import assert from "node:assert/strict";
import "../js/core/event-stream.js";
const { consume } = globalThis.GastosEventStream;
test("SSE suporta UTF-8, CRLF e frames divididos em cada byte sem perder acentos", async () => {
  const bytes = new TextEncoder().encode(
    ': keepalive\r\n\r\ndata: {"text":"Você gastou R$ 42"}\r\n\r\ndata: [DONE]\r\n\r\n',
  );
  const response = new Response(
    new ReadableStream({
      start(output) {
        for (const byte of bytes) output.enqueue(new Uint8Array([byte]));
        output.close();
      },
    }),
  );
  const events = [];
  await consume(response, (event) => events.push(event));
  assert.deepEqual(events, [{ text: "Você gastou R$ 42" }]);
});
test("SSE não ignora JSON inválido nem acumula frame sem limite", async () => {
  await assert.rejects(
    consume(new Response("data: invalid\n\n"), () => {}),
    SyntaxError,
  );
  await assert.rejects(
    consume(new Response("data: " + "x".repeat(140000)), () => {}),
    /STREAM_TOO_LARGE/,
  );
});
test("SSE cancela leitor bloqueado ao interromper a conversa", async () => {
  let stopped = false;
  const controller = new AbortController();
  const response = new Response(
    new ReadableStream({
      cancel() {
        stopped = true;
      },
    }),
  );
  const pending = consume(response, () => {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(stopped, true);
});
test("SSE também limita frames grandes que chegam completos em um único chunk", async () => {
  await assert.rejects(
    consume(
      new Response(
        "data: " + JSON.stringify({ text: "x".repeat(140000) }) + "\n\n",
      ),
      () => {},
    ),
    /STREAM_TOO_LARGE/,
  );
});
