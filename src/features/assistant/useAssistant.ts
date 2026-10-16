import { analysisPeriod } from "../../../js/core/analysis-period.mjs";
import { useEffect, useRef, useState } from "react";
import {
  conversationRef,
  parseConversation,
  parseWallets,
  parseAnalysis,
} from "../../shared/api/conversation";
import type {
  AssistantPorts,
  ChatError,
  Context,
  ConversationRef,
  Message,
} from "./contracts";

type Snapshot = { messages: Message[]; conversation: ConversationRef | null };
const empty = (): Snapshot => ({ messages: [], conversation: null });
const contextKey = (context: Context) => JSON.stringify(context);
const errorOf = (cause: unknown): ChatError => {
  if (cause instanceof Error)
    return {
      message: cause.message,
      ...("code" in cause && typeof cause.code === "string"
        ? { code: cause.code }
        : {}),
    };
  return { message: "Não foi possível concluir. Tente novamente." };
};
export function houseMonth(ports: AssistantPorts) {
  const [month, year] = ports.getSelectedMonth().split("/");
  return year && month
    ? `${year}-${month}`
    : new Date().toISOString().slice(0, 7);
}
function history(messages: Message[], question: Message) {
  const pairs: Pick<Message, "role" | "content">[] = [];
  for (let i = 0; i < messages.length - 2; i += 2) {
    const user = messages[i],
      answer = messages[i + 1];
    if (
      user?.role === "user" &&
      answer?.role === "assistant" &&
      answer.status === "success"
    )
      pairs.push(
        { role: user.role, content: user.content },
        { role: answer.role, content: answer.content },
      );
  }
  let result = pairs.slice(-20);
  while (
    result.reduce(
      (sum, message) => sum + message.content.length,
      question.content.length,
    ) > 30000
  )
    result = result.slice(2);
  return [...result, { role: question.role, content: question.content }];
}
export function useAssistant(ports: AssistantPorts) {
  const [context, setContext] = useState<Context>({
    scope: "house",
    month: houseMonth(ports),
  });
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [wallets, setWallets] = useState<{ id: string; nome: string }[]>([]);
  const [error, setError] = useState<ChatError | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAction, setRetryAction] = useState<"send" | "delete" | "history">(
    "send",
  );
  const [status, setStatus] = useState(
    "Você revisa qualquer lançamento antes de salvar.",
  );
  const [text, setText] = useState("");
  const cache = useRef(new Map<string, Snapshot>());
  const current = useRef(context);
  const serial = useRef(0);
  const walletSerial = useRef(0);
  const active = useRef<{
    controller: AbortController;
    answer?: Message;
  } | null>(null);
  const alive = useRef(true);
  const publish = (value: Snapshot) => {
    const key = contextKey(current.current);
    if (!cache.current.has(key) && cache.current.size >= 20) {
      const oldest = cache.current.keys().next().value;
      if (oldest) cache.current.delete(oldest);
    }
    cache.current.set(key, value);
    setSnapshot({ ...value, messages: [...value.messages] });
  };
  function cancel() {
    serial.current++;
    if (active.current?.answer) active.current.answer.status = "stopped";
    active.current?.controller.abort();
    active.current = null;
    if (alive.current) setBusy(false);
  }
  async function load(next: Context, force = false) {
    try {
      analysisPeriod(next);
    } catch {
      setError({
        message: "Escolha um período válido de até 12 meses.",
        code: "INVALID_CONTEXT",
      });
      return;
    }
    cancel();
    current.current = next;
    setContext(next);
    setError(null);
    const cached = cache.current.get(contextKey(next));
    if (cached && !force) {
      setSnapshot({ ...cached, messages: [...cached.messages] });
      setPhase("ready");
      return;
    }
    setSnapshot(empty());
    setPhase("loading");
    const turn = serial.current;
    const controller = new AbortController();
    active.current = { controller };
    try {
      const conversation = parseConversation(
        await ports.api.fetchConversation(next, { signal: controller.signal }),
      );
      if (turn !== serial.current) return;
      active.current = null;
      publish(
        conversation
          ? {
              messages: conversation.messages,
              conversation: {
                id: conversation.id,
                revision: conversation.revision,
              },
            }
          : empty(),
      );
      setPhase("ready");
      setStatus(
        "Conversa privada salva. Você revisa qualquer lançamento antes de salvar.",
      );
    } catch (cause) {
      if (turn !== serial.current) return;
      setPhase("error");
      setRetryAction("history");
      setError(errorOf(cause));
    } finally {
      if (turn === serial.current) active.current = null;
    }
  }
  async function loadWallets() {
    const turn = ++walletSerial.current;
    try {
      const items = parseWallets(await ports.api.fetchWallets());
      if (alive.current && turn === walletSerial.current) setWallets(items);
    } catch {
      /* Shared context remains available; wallet failures have their own screen. */
    }
  }
  async function send(retry = false, prompt?: string) {
    if (
      active.current ||
      phase !== "ready" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(current.current.month)
    )
      return;
    const value = cache.current.get(contextKey(current.current)) ?? empty();
    let user: Message, answer: Message;
    const last = value.messages.at(-1),
      previous = value.messages.at(-2);
    if (
      retry &&
      last?.role === "assistant" &&
      ["failed", "stopped"].includes(last.status ?? "") &&
      previous?.role === "user"
    ) {
      user = previous;
      answer = last;
      answer.content = "";
      delete answer.analysis;
      answer.status = "pending";
    } else {
      const content = (prompt ?? text).trim();
      if (!content || content.length > 2000) return;
      user = { role: "user", content };
      answer = { role: "assistant", content: "", status: "pending" };
      value.messages.push(user, answer);
      value.messages = value.messages.slice(-100);
      setText("");
    }
    const turn = ++serial.current,
      controller = new AbortController();
    active.current = { controller, answer };
    setBusy(true);
    setRetryAction("send");
    setError(null);
    publish(value);
    setStatus("Preparando uma resposta…");
    try {
      await ports.api.streamAssistant(
        {
          context: current.current,
          conversation: value.conversation,
          messages: history(value.messages, user),
        },
        {
          signal: controller.signal,
          onEvent(event) {
            if (turn !== serial.current) return;
            if (
              (event.type === "start" || event.type === "end") &&
              event.conversation
            )
              value.conversation = conversationRef(event.conversation);
            if (event.type === "start" && event.analysis !== undefined) {
              const analysis = parseAnalysis(event.analysis);
              if (
                analysis.endMonth !== current.current.month ||
                analysis.startMonth !==
                  (current.current.startMonth || current.current.month)
              )
                throw new Error("A resposta pertence a outro período.");
              answer.analysis = analysis;
              publish(value);
            }
            if (event.type === "text") {
              answer.content += event.text;
              if (answer.content.length > 12000)
                throw new Error(
                  "A resposta excedeu o limite. Tente uma pergunta mais curta.",
                );
              publish(value);
              setStatus("O assistente está respondendo…");
            }
          },
        },
      );
      if (turn !== serial.current) return;
      if (!answer.content.trim())
        throw new Error("A IA não retornou texto. Tente novamente.");
      answer.status = "success";
      publish(value);
      setStatus("Resposta concluída. Confira os valores antes de decidir.");
    } catch (cause) {
      if (turn !== serial.current) return;
      answer.status = "failed";
      publish(value);
      setError(errorOf(cause));
      setStatus("Sua mensagem foi mantida. Você pode tentar novamente.");
    } finally {
      if (turn === serial.current) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  function stop() {
    if (!active.current?.answer) return;
    cancel();
    const value = cache.current.get(contextKey(current.current));
    if (value) publish(value);
    setError({ message: "Resposta interrompida. Sua mensagem foi mantida." });
    setStatus("Sua mensagem foi mantida. Você pode tentar novamente.");
  }
  async function clear() {
    if (active.current) return;
    const value = cache.current.get(contextKey(current.current)) ?? empty();
    const turn = ++serial.current,
      controller = new AbortController();
    active.current = { controller };
    setBusy(true);
    try {
      if (value.conversation)
        await ports.api.deleteConversation(
          current.current,
          value.conversation,
          { signal: controller.signal },
        );
      if (turn !== serial.current) return;
      publish(empty());
      setError(null);
      setStatus("Conversa excluída. Comece uma nova pergunta.");
    } catch (cause) {
      if (turn === serial.current) {
        setRetryAction("delete");
        setError(errorOf(cause));
      }
    } finally {
      if (turn === serial.current) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    const enter = (event: Event) => {
      const view = (event as CustomEvent<{ view: string }>).detail.view;
      if (view === "assistente") {
        void load(current.current);
        void loadWallets();
      } else {
        cancel();
        const value = cache.current.get(contextKey(current.current));
        if (value) publish(value);
      }
    };
    const sessionCleared = () => {
      cancel();
      walletSerial.current++;
      cache.current.clear();
      setWallets([]);
      setText("");
      setError(null);
      setSnapshot(empty());
      setPhase("idle");
      current.current = { scope: "house", month: houseMonth(ports) };
      setContext(current.current);
    };
    const authenticated = () => {
      if (window.GastosNavigation.current() === "assistente") {
        void load(current.current, true);
        void loadWallets();
      }
    };
    const monthChanged = () => {
      if (current.current.scope === "house")
        void load({ scope: "house", month: houseMonth(ports) });
    };
    const request = (event: Event) => {
      const detail = (event as CustomEvent<{ context: Context; text: string }>)
        .detail;
      if (
        !detail ||
        detail.context?.scope !== "wallet" ||
        !/^[0-9a-f-]{36}$/i.test(detail.context.walletId) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(detail.context.month) ||
        typeof detail.text !== "string" ||
        detail.text.length > 2000
      )
        return;
      setText(detail.text);
      void load(detail.context);
    };
    window.addEventListener("gastos:assistantrequest", request);
    window.addEventListener("gastos:viewchange", enter);
    window.addEventListener("gastos:sessioncleared", sessionCleared);
    window.addEventListener("gastos:authenticated", authenticated);
    document
      .getElementById("seletorMes")
      ?.addEventListener("change", monthChanged);
    if (window.GastosNavigation.current() === "assistente") {
      void load(current.current);
      void loadWallets();
    }
    return () => {
      window.removeEventListener("gastos:assistantrequest", request);
      alive.current = false;
      cancel();
      walletSerial.current++;
      window.removeEventListener("gastos:viewchange", enter);
      window.removeEventListener("gastos:sessioncleared", sessionCleared);
      window.removeEventListener("gastos:authenticated", authenticated);
      document
        .getElementById("seletorMes")
        ?.removeEventListener("change", monthChanged);
    };
  }, [ports]);
  return {
    context,
    messages: snapshot.messages,
    phase,
    wallets,
    error,
    busy,
    generating: busy && Boolean(active.current?.answer),
    retryAction,
    status,
    text,
    setText,
    send,
    stop,
    clear,
    changeContext: load,
    reload: () => load(current.current, true),
  };
}
