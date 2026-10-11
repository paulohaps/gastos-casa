import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, type Phase, type SettingsPorts } from "./contracts";
import {
  parseMetrics,
  percentage,
  duration,
  type Metrics as MetricsData,
} from "./metrics";
export function Metrics({ ports }: { ports: SettingsPorts }) {
  const [data, setData] = useState<MetricsData | null>(null),
    [phase, setPhase] = useState<Phase>("idle"),
    [error, setError] = useState(""),
    [days, setDays] = useState(30);
  const turn = useRef(0),
    pending = useRef<AbortController | null>(null),
    period = useRef(30);
  const load = useCallback(async () => {
    pending.current?.abort();
    const abort = new AbortController(),
      request = ++turn.current;
    pending.current = abort;
    setData(null);
    setPhase("loading");
    setError("");
    try {
      const value = parseMetrics(
        await ports.api.fetchSmartMetrics(period.current, {
          signal: abort.signal,
        }),
      );
      if (request !== turn.current) return;
      if (value.days !== period.current)
        throw new Error(
          "O período da resposta não corresponde ao selecionado. Tente novamente.",
        );
      setData(value);
      setPhase(value.interpretations ? "success" : "empty");
    } catch (error) {
      if (request === turn.current && !abort.signal.aborted) {
        setPhase("error");
        setError(errorMessage(error));
      }
    } finally {
      if (request === turn.current) pending.current = null;
    }
  }, [ports]);
  useEffect(() => {
    const clear = () => {
      turn.current++;
      pending.current?.abort();
      pending.current = null;
      period.current = 30;
      setDays(30);
      setData(null);
      setPhase("idle");
      setError("");
    };
    window.addEventListener("gastos:metricsload", load);
    window.addEventListener("gastos:sessioncleared", clear);
    window.addEventListener("gastos:authenticated", load);
    void load();
    return () => {
      turn.current++;
      pending.current?.abort();
      window.removeEventListener("gastos:metricsload", load);
      window.removeEventListener("gastos:sessioncleared", clear);
      window.removeEventListener("gastos:authenticated", load);
    };
  }, [load]);
  const confirmed = data?.confirmed || 0;
  return (
    <details
      className="surface-card settings-group smart-metrics-settings assistant-learning"
      id="settingsQuality"
    >
      <summary>Qualidade do lançamento rápido</summary>
      <section aria-labelledby="smartMetricsTitle">
        <div className="section-heading section-heading--compact">
          <div>
            <h3 className="section-title" id="smartMetricsTitle">
              Aprendizado em números
            </h3>
            <p className="supporting-text">
              Confira os resultados dos gastos que você revisou e confirmou.
            </p>
          </div>
          <label className="smart-metrics-period">
            <span>Período</span>
            <select
              id="smartMetricsDays"
              value={days}
              onChange={(event) => {
                period.current = Number(event.target.value);
                setDays(period.current);
                void load();
              }}
            >
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
            </select>
          </label>
        </div>
        {(phase === "idle" || phase === "loading") && (
          <p className="loading-inline" role="status">
            <span className="spinner" />
            Carregando qualidade...
          </p>
        )}
        {phase === "error" && (
          <p className="module-error" role="alert">
            {error}
            <button type="button" onClick={() => void load()}>
              Tentar novamente
            </button>
          </p>
        )}
        {phase === "empty" && (
          <p className="recurring-empty">
            Ainda não há lançamentos rápidos neste período.
          </p>
        )}
        <div className="smart-metrics-grid" aria-busy={phase === "loading"}>
          <article className="smart-metric-card">
            <span>Interpretações</span>
            <strong id="smartMetricInterpretacoes">
              {data?.interpretations ?? "—"}
            </strong>
            <small id="smartMetricInterpretacoesMeta">
              {data
                ? data.unsupported
                  ? `${data.unsupported} ${data.unsupported === 1 ? "comando/consulta rejeitado" : "comandos/consultas rejeitados"}`
                  : "Somente tentativas válidas ou protegidas"
                : "Aguardando dados"}
            </small>
          </article>
          <article className="smart-metric-card">
            <span>Confirmados</span>
            <strong id="smartMetricConfirmados">
              {data?.confirmed ?? "—"}
            </strong>
            <small id="smartMetricConfirmadosMeta">
              {data?.expenseInterpretations
                ? `${percentage(data.confirmationRate)} das interpretações de gasto`
                : "Ainda sem amostra"}
            </small>
          </article>
          <article className="smart-metric-card">
            <span>Sem correção</span>
            <strong id="smartMetricSemCorrecao">
              {confirmed && data ? percentage(data.noCorrectionRate) : "—"}
            </strong>
            <small id="smartMetricSemCorrecaoMeta">
              {confirmed && data
                ? `${data.noCorrection} de ${confirmed} confirmados`
                : "Ainda sem lançamentos confirmados"}
            </small>
          </article>
          <article className="smart-metric-card">
            <span>Tempo até confirmar</span>
            <strong id="smartMetricTempo">
              {duration(data?.seconds ?? null)}
            </strong>
            <small id="smartMetricTempoMeta">Média dos confirmados</small>
          </article>
        </div>
        <div className="smart-metrics-detail">
          <div className="smart-metrics-block">
            <div className="smart-metrics-block__head">
              <strong>Correções por campo</strong>
              <span>Menor é melhor</span>
            </div>
            <div className="smart-correction-list" id="smartMetricsCorrecoes">
              {data?.corrections.map((item) => (
                <div className="smart-correction-row" key={item.key}>
                  <div className="smart-correction-row__head">
                    <span>
                      {
                        {
                          value: "Valor",
                          description: "Descrição",
                          category: "Categoria",
                          payment: "Pagamento",
                          date: "Data",
                        }[item.key]
                      }
                    </span>
                    <strong>{confirmed ? percentage(item.rate) : "—"}</strong>
                  </div>
                  <div className="smart-correction-row__track">
                    <span style={{ width: `${item.rate ?? 0}%` }} />
                  </div>
                  <small>{item.count} correções</small>
                </div>
              ))}
            </div>
          </div>
          <div className="smart-metrics-block">
            <div className="smart-metrics-block__head">
              <strong>Impacto do aprendizado</strong>
              <span>Categoria</span>
            </div>
            <div
              className="smart-learning-impact"
              id="smartMetricsLearningImpact"
            >
              {data && <Impact data={data} />}
            </div>
          </div>
        </div>
      </section>
    </details>
  );
}
function Impact({ data }: { data: MetricsData }) {
  const value = data.impact;
  const signal =
    value.improvement === null
      ? "comparação indisponível"
      : value.improvement === 0
        ? "mesma taxa de correção"
        : `${Math.abs(value.improvement).toFixed(1).replace(".", ",")} p.p. ${value.improvement > 0 ? "menos" : "mais"} correções`;
  return (
    <>
      <div className="smart-learning-impact__card">
        <div>
          <strong>
            {!value.learned
              ? "Aguardando uso do aprendizado"
              : value.learned < 3 || value.baseline < 3
                ? "Amostra inicial"
                : signal}
          </strong>
          <p>
            {!value.learned
              ? "Quando regras aprendidas participarem de lançamentos confirmados, o app compara a taxa de correção."
              : value.learned < 3 || value.baseline < 3
                ? `${value.learned} confirmados com aprendizado e ${value.baseline} sem aprendizado. A comparação exige pelo menos 3 casos em cada grupo.`
                : `Categoria: ${percentage(value.learnedRate)} com aprendizado vs ${percentage(value.baselineRate)} sem aprendizado. ${value.learned} vs ${value.baseline} confirmações.`}
          </p>
        </div>
      </div>
      <p className="smart-learning-impact__meta">
        {data.unconfirmed} interpretações ainda sem confirmação •{" "}
        {data.learningRecorded} evidências de aprendizado registradas
      </p>
    </>
  );
}
