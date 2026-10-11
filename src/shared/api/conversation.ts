import type {
  Conversation,
  ConversationRef,
} from "../../features/assistant/contracts";
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
export function conversationRef(value: unknown): ConversationRef {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.id,
    ) ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  )
    throw new Error("O histórico recebido é inválido. Tente novamente.");
  return { id: value.id, revision: value.revision };
}
export function parseConversation(value: unknown): Conversation | null {
  if (!record(value) || !Object.hasOwn(value, "conversation"))
    throw new Error("Não foi possível validar seu histórico.");
  if (value.conversation === null) return null;
  const ref = conversationRef(value.conversation);
  const row = value.conversation;
  if (
    !record(row) ||
    !Array.isArray(row.messages) ||
    row.messages.length > 100 ||
    row.messages.length % 2
  )
    throw new Error("Seu histórico está incompleto. Tente novamente.");
  const messages = row.messages.map((message: unknown, index: number) => {
    const role = index % 2 === 0 ? "user" : "assistant";
    if (
      !record(message) ||
      message.role !== role ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > (role === "user" ? 2000 : 12000)
    )
      throw new Error("Mensagem inválida no histórico.");
    return { role, content: message.content, status: "success" } as const;
  });
  return { ...ref, messages };
}

export function parseWallets(value: unknown): { id: string; nome: string }[] {
  if (!Array.isArray(value)) throw new Error("Lista de carteiras inválida.");
  return value.map((wallet: unknown) => {
    if (
      !record(wallet) ||
      typeof wallet.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        wallet.id,
      ) ||
      typeof wallet.nome !== "string" ||
      !wallet.nome.trim() ||
      wallet.nome.length > 100
    )
      throw new Error("Carteira inválida.");
    return { id: wallet.id, nome: wallet.nome };
  });
}
