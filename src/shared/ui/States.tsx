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
export function EmptyState({ message }: { message: string }) {
  return <p className="dashboard-empty">{message}</p>;
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
