import type { ReactNode } from "react";
import { Icon } from "./Icon";
export function MetricCard({
  label,
  value,
  note,
  icon,
  id,
  tone = "neutral",
  children,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  id?: string;
  tone?: "green" | "purple" | "warning" | "neutral";
  children?: ReactNode;
}) {
  return (
    <article className={"premium-metric premium-metric--" + tone}>
      <div className="premium-metric__label">
        <span>{label}</span>
        <Icon name={icon} />
      </div>
      <strong id={id} className="premium-metric__value">
        {value}
      </strong>
      <p>{note}</p>
      {children}
    </article>
  );
}
