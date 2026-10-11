import { useCallback, useEffect, useRef, useState } from "react";
import {
  errorMessage,
  parseConnection,
  parseSaved,
  record,
  type Phase,
  type Provider,
  type SavedSettings,
  type SettingsPorts,
} from "./contracts";
export function useConnection(ports: SettingsPorts) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [saved, setSaved] = useState<SavedSettings | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("gemini"),
    [model, setModel] = useState(""),
    [custom, setCustom] = useState(""),
    [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const version = useRef(0),
    loading = useRef(false),
    acting = useRef(false),
    loaded = useRef(false);
  const apply = useCallback(
    (value: SavedSettings | null, options: Provider[]) => {
      const selected =
        options.find((p) => p.id === value?.provider) || options[0];
      setSaved(value);
      setProvider(selected?.id || "gemini");
      const known = selected?.models.some((m) => m.id === value?.model);
      setModel(
        value && !known
          ? "custom"
          : value?.model || selected?.models[0]?.id || "",
      );
      setCustom(value && !known ? value.model : "");
    },
    [],
  );
  const load = useCallback(async () => {
    if (loading.current) return;
    const turn = version.current;
    loading.current = true;
    setPhase("loading");
    setStatus("");
    setReady(false);
    setSaved(null);
    setProviders([]);
    try {
      const data = parseConnection(await ports.api.fetchAiSettings());
      if (turn !== version.current) return;
      setProviders(data.providers);
      apply(data.saved, data.providers);
      setReady(data.storageReady);
      loaded.current = true;
      setPhase(data.saved?.hasKey ? "success" : "empty");
      if (!data.storageReady)
        setStatus(
          "A configuração de IA ainda não está disponível neste ambiente.",
        );
    } catch (error) {
      if (turn === version.current) {
        setPhase("error");
        setStatus(errorMessage(error));
      }
    } finally {
      if (turn === version.current) loading.current = false;
    }
  }, [ports, apply]);
  useEffect(() => {
    const clear = () => {
      version.current++;
      loading.current = false;
      acting.current = false;
      loaded.current = false;
      setPhase("idle");
      setReady(false);
      setBusy(false);
      setProviders([]);
      setSaved(null);
      setKey("");
      setCustom("");
      setModel("");
      setProvider("gemini");
      setStatus("");
    };
    const view = (event: Event) => {
      if ((event as CustomEvent<{ view: string }>).detail.view === "ajustes") {
        if (!loaded.current) void load();
      } else setKey("");
    };
    const authenticated = () => {
      if (window.GastosNavigation.current() === "ajustes") void load();
    };
    window.addEventListener("gastos:sessioncleared", clear);
    window.addEventListener("gastos:viewchange", view);
    window.addEventListener("gastos:authenticated", authenticated);
    if (window.GastosNavigation.current() === "ajustes") void load();
    return () => {
      clear();
      window.removeEventListener("gastos:sessioncleared", clear);
      window.removeEventListener("gastos:viewchange", view);
      window.removeEventListener("gastos:authenticated", authenticated);
    };
  }, [load]);
  async function act(
    action: "save" | "test" | "delete",
    form?: HTMLFormElement,
  ) {
    if (
      acting.current ||
      !ready ||
      (action !== "delete" && !form?.reportValidity())
    )
      return;
    const turn = version.current;
    acting.current = true;
    setBusy(true);
    try {
      if (action === "delete") {
        const confirmed = await ports.ui.confirmAction({
          title: "Remover chave de IA?",
          message: "Você pode conectar outra chave depois.",
          confirmLabel: "Remover chave",
        });
        if (!confirmed || turn !== version.current) return;
      }
      setStatus(
        action === "test"
          ? "Testando uma chamada curta ao modelo…"
          : "Salvando…",
      );
      const data = record(
        await ports.api.saveAiSettings({
          action,
          provider,
          model: model === "custom" ? custom.trim() : model,
          ...(key.trim() ? { apiKey: key.trim() } : {}),
        }),
      );
      if (turn !== version.current) return;
      if (action === "test") {
        if (record(data.connection).ok !== true)
          throw new Error(
            "O provedor não confirmou a conexão. Tente novamente.",
          );
        setStatus(
          "Conexão confirmada. Salve a configuração para usar nas análises.",
        );
      } else {
        const value = parseSaved(data.settings);
        apply(value, providers);
        setKey("");
        setPhase(value?.hasKey ? "success" : "empty");
        setStatus(
          action === "delete"
            ? "Chave removida. As recomendações automáticas continuam disponíveis."
            : "Configuração salva. Você já pode conversar com o Assistente.",
        );
        window.dispatchEvent(new CustomEvent("gastos:aichange"));
      }
    } catch (error) {
      if (turn === version.current) setStatus(errorMessage(error));
    } finally {
      if (turn === version.current) {
        acting.current = false;
        setBusy(false);
      }
    }
  }
  function selectProvider(id: string) {
    setProvider(id);
    setModel(providers.find((p) => p.id === id)?.models[0]?.id || "");
    setCustom("");
    setKey("");
    setStatus("");
  }
  return {
    phase,
    providers,
    saved,
    ready,
    busy,
    provider,
    model,
    custom,
    key,
    status,
    load,
    act,
    selectProvider,
    setModel,
    setCustom,
    setKey,
  };
}
