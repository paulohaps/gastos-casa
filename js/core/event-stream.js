(function (root) {
  "use strict";
  // Shared SSE framing for the browser and provider adapters. UTF-8 and frames
  // can arrive split across arbitrary network chunks.
  async function consume(response, onEvent, signal) {
    if (!response.body) throw new Error("STREAM_UNAVAILABLE");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const cancel = () => {
      reader.cancel().catch(() => {});
    };
    signal?.addEventListener("abort", cancel, { once: true });
    async function frames() {
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        if (data.length > 131072) throw new Error("STREAM_TOO_LARGE");
        await onEvent(JSON.parse(data));
      }
      if (buffer.length > 131072) throw new Error("STREAM_TOO_LARGE");
    }
    try {
      signal?.throwIfAborted();
      while (true) {
        const { value, done } = await reader.read();
        signal?.throwIfAborted();
        buffer += decoder.decode(value, { stream: !done });
        // Normalize CRLF after combining chunks, including a split CR/LF pair.
        buffer = buffer.replace(/\r\n/g, "\n");
        await frames();
        if (done) break;
      }
      if (buffer.trim()) {
        buffer += "\n\n";
        await frames();
      }
    } finally {
      signal?.removeEventListener("abort", cancel);
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  root.GastosEventStream = Object.freeze({ consume });
})(globalThis);
