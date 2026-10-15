import { useEffect, useState, type ReactNode } from "react";
import { useMediaQuery } from "./useMediaQuery";
export function ChartCard({
  title,
  description,
  id,
  className = "",
  children,
  progressive = false,
  action,
}: {
  title: string;
  description?: string;
  id: string;
  className?: string;
  children: ReactNode;
  progressive?: boolean;
  action?: ReactNode;
}) {
  const mobile = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = useState(!mobile);
  useEffect(() => setOpen(!mobile), [mobile]);
  const heading = (
    <div>
      <h2 id={id}>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
  if (progressive)
    return (
      <details
        className={"dashboard-card dashboard-progressive " + className}
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary>
          {heading}
          <span className="section-disclosure" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </summary>
        <div className="dashboard-section-body">{children}</div>
      </details>
    );
  return (
    <section className={"dashboard-card " + className} aria-labelledby={id}>
      <header>
        {heading}
        {action}
      </header>
      {children}
    </section>
  );
}
