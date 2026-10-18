export function MetricCard({
  label,
  value,
  note,
  id,
  onInspect,
}: {
  label: string;
  value: string;
  note: string;
  id?: string;
  onInspect?: () => void;
}) {
  const content = (
    <>
      <span className="premium-metric__label">{label}</span>
      <strong id={id} className="premium-metric__value">
        {value}
      </strong>
      <span className="premium-metric__note">{note}</span>
    </>
  );
  return (
    <article className="premium-metric">
      {onInspect ? (
        <button
          className="premium-metric__inspect"
          type="button"
          onClick={onInspect}
          aria-label={"Detalhar: " + label}
        >
          {content}
          <span className="metric-inspect-hint" aria-hidden="true">
            Ver detalhes ↗
          </span>
        </button>
      ) : (
        content
      )}
    </article>
  );
}
