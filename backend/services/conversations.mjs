import { parseAnalysis } from "../../js/core/analysis-snapshot.mjs";
import { randomUUID } from "node:crypto";
import { validateConversation } from "./assistant.mjs";

const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateContext(context) {
  return validateConversation({
    context,
    messages: [{ role: "user", content: "context" }],
  }).context;
}
export function contextKey(context) {
  const safe = validateContext(context);
  return (
    (safe.scope === "house"
      ? "house"
      : "wallet:" + safe.walletId.toLowerCase()) +
    ":" +
    (safe.startMonth ? safe.startMonth + ".." + safe.month : safe.month)
  );
}
export function validateStoredConversation(row) {
  if (
    !row ||
    !uuid(row.id) ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    !Array.isArray(row.messages) ||
    row.messages.length > 100 ||
    row.messages.length % 2
  )
    throw new Error("HISTORY_UNAVAILABLE");
  row.messages.forEach((message, index) => {
    if (
      message?.role !== (index % 2 ? "assistant" : "user") ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > (index % 2 ? 12000 : 2000)
    )
      throw new Error("HISTORY_UNAVAILABLE");
    if (message.analysis !== undefined) {
      if (index % 2 === 0) throw new Error("HISTORY_UNAVAILABLE");
      try {
        parseAnalysis(message.analysis);
      } catch {
        throw new Error("HISTORY_UNAVAILABLE");
      }
    }
  });
  return {
    id: row.id,
    revision: row.revision,
    messages: row.messages.map(({ role, content, analysis }) => ({
      role,
      content,
      ...(analysis !== undefined ? { analysis: parseAnalysis(analysis) } : {}),
    })),
  };
}
export function modelHistory(messages, question) {
  let history = messages.slice(-20);
  while (
    history.reduce(
      (sum, message) => sum + message.content.length,
      question.length,
    ) > 30000
  )
    history = history.slice(2);
  return [...history, { role: "user", content: question }];
}
export function createConversationsService({ dataApi }) {
  async function rows(path, options, jwt) {
    try {
      const response = await dataApi(path, options, jwt);
      if (!response.ok) throw new Error("HISTORY_UNAVAILABLE");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("HISTORY_UNAVAILABLE");
      return data;
    } catch (cause) {
      options.signal?.throwIfAborted();
      throw new Error("HISTORY_UNAVAILABLE", { cause });
    }
  }
  async function authorize(owner, jwt, context, signal) {
    if (!uuid(owner)) throw new Error("INVALID_OWNER");
    validateContext(context);
    if (context.scope === "wallet") {
      const wallets = await rows(
        "/personal_wallets?select=id&owner_id=eq." +
          owner +
          "&id=eq." +
          context.walletId +
          "&limit=1",
        { method: "GET", signal },
        jwt,
      );
      if (wallets.length !== 1) throw new Error("WALLET_NOT_FOUND");
    }
  }
  const pathFor = (owner, context) =>
    "/assistant_conversations?owner_id=eq." +
    owner +
    "&context_key=eq." +
    encodeURIComponent(contextKey(context));
  async function get(owner, jwt, context, signal) {
    await authorize(owner, jwt, context, signal);
    const result = await rows(
      pathFor(owner, context) + "&select=id,revision,messages&limit=1",
      { method: "GET", signal },
      jwt,
    );
    return result.length ? validateStoredConversation(result[0]) : null;
  }
  async function begin(owner, jwt, context, expected, signal) {
    let current = await get(owner, jwt, context, signal);
    if (
      expected !== null &&
      (!expected ||
        !uuid(expected.id) ||
        !Number.isSafeInteger(expected.revision) ||
        expected.revision < 0)
    )
      throw new Error("INVALID_MESSAGES");
    if (
      current &&
      !(expected === null && current.messages.length === 0) &&
      (expected?.id !== current.id || expected?.revision !== current.revision)
    )
      throw new Error("HISTORY_CONFLICT");
    if (!current && expected !== null) throw new Error("HISTORY_CONFLICT");
    if (!current) {
      const id = randomUUID();
      const result = await rows(
        "/assistant_conversations?on_conflict=owner_id,context_key",
        {
          method: "POST",
          signal,
          headers: {
            Prefer: "resolution=ignore-duplicates,return=representation",
          },
          body: JSON.stringify({
            id,
            owner_id: owner,
            context_key: contextKey(context),
            messages: [],
            revision: 0,
          }),
        },
        jwt,
      );
      if (result.length !== 1 || result[0].id !== id)
        throw new Error("HISTORY_CONFLICT");
      current = validateStoredConversation(result[0]);
    }
    return current;
  }
  async function complete(
    owner,
    jwt,
    snapshot,
    question,
    answer,
    signal,
    analysis,
  ) {
    signal?.throwIfAborted();
    let messages = [
      ...snapshot.messages,
      { role: "user", content: question },
      {
        role: "assistant",
        content: answer,
        ...(analysis ? { analysis: parseAnalysis(analysis) } : {}),
      },
    ].slice(-100);
    while (Buffer.byteLength(JSON.stringify(messages), "utf8") > 1400000)
      messages = messages.slice(2);
    validateStoredConversation({ ...snapshot, messages });
    const result = await rows(
      "/assistant_conversations?owner_id=eq." +
        owner +
        "&id=eq." +
        snapshot.id +
        "&revision=eq." +
        snapshot.revision,
      {
        method: "PATCH",
        signal,
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          messages,
          revision: snapshot.revision + 1,
          updated_at: new Date().toISOString(),
        }),
      },
      jwt,
    );
    if (result.length !== 1) throw new Error("HISTORY_CONFLICT");
    return validateStoredConversation(result[0]);
  }
  async function remove(owner, jwt, context, expected, signal) {
    await authorize(owner, jwt, context, signal);
    if (
      !expected ||
      !uuid(expected.id) ||
      !Number.isSafeInteger(expected.revision)
    )
      throw new Error("INVALID_MESSAGES");
    const result = await rows(
      pathFor(owner, context) +
        "&id=eq." +
        expected.id +
        "&revision=eq." +
        expected.revision,
      {
        method: "DELETE",
        signal,
        headers: { Prefer: "return=representation" },
      },
      jwt,
    );
    if (result.length !== 1) throw new Error("HISTORY_CONFLICT");
  }
  return { get, begin, complete, remove };
}
