import type { ReactNode } from "react";
export function ChartCard({
  title,
  description,
  id,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={"dashboard-card " + className} aria-labelledby={id}>
      <header>
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
