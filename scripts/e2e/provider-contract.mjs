import { runtimeConfig } from "../../backend/runtime-config.mjs";
const marker =
  "Dados autorizados (campos Cents em centavos; demais valores monetários em reais): ";
const currency = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export function installContractProvider(env) {
  if (runtimeConfig(env).environment !== "preview")
    throw Error("CONTRACT_PROVIDER_REQUIRES_ISOLATION");
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (
      !["api.deepseek.com", "generativelanguage.googleapis.com"].includes(
        url.hostname,
      )
    )
      return nativeFetch(input, init);
    const headers = new Headers(init.headers),
      key =
        headers.get("x-goog-api-key") ||
        headers.get("authorization")?.replace(/^Bearer /, "");
    if (!key?.startsWith("e2e-contract-"))
      return Response.json(
        { error: "Contract provider accepts synthetic test credentials only" },
        { status: 401 },
      );
    const body = JSON.parse(init.body),
      gemini = url.hostname === "generativelanguage.googleapis.com";
    const instruction = gemini
      ? body.systemInstruction?.parts?.map((p) => p.text || "").join("")
      : body.messages?.find((m) => m.role === "system")?.content || "";
    const stream = gemini
      ? url.pathname.includes("streamGenerateContent")
      : body.stream === true;
    if (!stream)
      return Response.json(
        gemini
          ? { candidates: [{ content: { parts: [{ text: "OK" }] } }] }
          : { choices: [{ message: { content: "OK" } }] },
      );
    const index = instruction.lastIndexOf(marker);
    if (index < 0)
      return Response.json(
        { error: "Authorized financial snapshot missing" },
        { status: 400 },
      );
    const snapshot = JSON.parse(instruction.slice(index + marker.length));
    const balance = snapshot.settlements;
    let text = "**Ensaio de integração: provedor simulado.**\n\n";
    if (balance?.status === "available") {
      text += `Você deve ${currency(balance.payableCents)} e tem ${currency(balance.receivableCents)} a receber no período selecionado.\n\n| Método | Direção | Valor |\n| --- | --- | --- |\n`;
      for (const row of balance.balances.filter((row) => row.amountCents > 0))
        text += `| ${row.method} | ${row.direction === "payable" ? "A pagar" : "A receber"} | ${currency(row.amountCents)} |\n`;
    } else {
      text += `O cofre selecionado tem ${currency(Math.round(snapshot.current.total * 100))} em gastos registrados. Não inclui gastos da Casa.\n`;
    }
    text += `\nA análise recebeu ${snapshot.current.count} lançamentos e heurísticas ${snapshot.expenseIntelligence?.version || "ausentes"}. `;
    if (snapshot.spendingPatterns?.evidence === "insufficient")
      text += "A amostra é pequena para afirmar um padrão.";
    const event = gemini
      ? {
          candidates: [
            { content: { parts: [{ text }] }, finishReason: "STOP" },
          ],
        }
      : { choices: [{ delta: { content: text }, finish_reason: "stop" }] };
    return new Response("data: " + JSON.stringify(event) + "\n\n", {
      headers: { "content-type": "text/event-stream" },
    });
  };
}
