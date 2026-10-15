import { Icon } from "./Icon";
export function QuickExpenseButton({
  className = "",
  label = "Nova despesa",
  appearance = "primary",
}: {
  className?: string;
  label?: string;
  appearance?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      className={"btn btn--" + appearance + " " + className}
      data-entry-open=""
      aria-label="Nova despesa"
    >
      <Icon name="plus" />
      <span>{label}</span>
    </button>
  );
}
