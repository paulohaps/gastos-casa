export function LoadingSkeleton({
  label = "Carregando dados",
}: {
  label?: string;
}) {
  return (
    <div className="loading-skeleton" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}
export function EmptyState({
  message,
  title,
  action,
}: {
  message: string;
  title?: string;
  action?: { label: string; run(): void };
}) {
  return (
    <div className="dashboard-empty">
      {title && <strong>{title}</strong>}
      <p>{message}</p>
      {action && (
        <button type="button" className="text-link" onClick={action.run}>
          {action.label} →
        </button>
      )}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="dashboard-error" role="alert">
      <p>{message}</p>
      {retry && (
        <button type="button" className="btn btn--secondary" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
