export function MetricCard({
  label,
  value,
  note,
  id,
}: {
  label: string;
  value: string;
  note: string;
  id?: string;
}) {
  return (
    <article className="premium-metric">
      <span className="premium-metric__label">{label}</span>
      <strong id={id} className="premium-metric__value">
        {value}
      </strong>
      <p>{note}</p>
    </article>
  );
}
