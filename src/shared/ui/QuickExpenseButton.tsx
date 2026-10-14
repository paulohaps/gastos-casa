import { Icon } from "./Icon";
export function QuickExpenseButton({
  className = "",
  label = "Nova despesa",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={"btn btn--primary " + className}
      data-entry-open=""
      aria-label="Nova despesa"
    >
      <Icon name="plus" />
      <span>{label}</span>
    </button>
  );
}
