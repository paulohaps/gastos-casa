import type { Analysis } from "../../../js/core/analysis-snapshot.mjs";
export type { Analysis };
export type Context = (
  | { scope: "house"; month: string }
  | { scope: "wallet"; month: string; walletId: string }
) & { startMonth?: string };
export type Message = {
  role: "user" | "assistant";
  content: string;
  analysis?: Analysis;
  status?: "pending" | "success" | "failed" | "stopped";
};
export type ConversationRef = { id: string; revision: number };
export type Conversation = ConversationRef & { messages: Message[] };
export type StreamEvent =
  | { type: "start"; conversation?: ConversationRef; analysis?: unknown }
  | { type: "text"; text: string }
  | { type: "end"; conversation?: ConversationRef };
export interface AssistantApi {
  fetchWallets(options?: {
    signal?: AbortSignal;
  }): Promise<{ id: string; nome: string }[]>;
  fetchConversation(
    context: Context,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  deleteConversation(
    context: Context,
    conversation: ConversationRef,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  streamAssistant(
    payload: {
      context: Context;
      messages: Pick<Message, "role" | "content">[];
      conversation: ConversationRef | null;
    },
    options: { signal: AbortSignal; onEvent: (event: StreamEvent) => void },
  ): Promise<void>;
}
export interface AssistantPorts {
  api: AssistantApi;
  getSelectedMonth(): string;
  navigate(view: string): void;
  review(message: string, context: Context): Promise<void>;
  openFinance(context: Context, action: "expenses" | "simulate"): Promise<void>;
}
export type ChatError = { message: string; code?: string };
