import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PanelProps = {
  title?: ReactNode;
  description?: ReactNode;
  /** Optional trailing header content (filters, actions). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Body padding. Set false when the child manages its own edges (e.g. a table). */
  padded?: boolean;
};

/**
 * Tier-3 content container — chart, form, or grouped content. Flat surface
 * (`border bg-card`, no shadow); the header is a `text-base` heading with an
 * optional muted subtitle. Replaces the hand-rolled `rounded-md border bg-card
 * p-4` + `text-lg` boxes scattered across the overviews.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="space-y-1">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}
