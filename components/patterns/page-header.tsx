import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ScopeItem = {
  label: string;
  value: ReactNode;
};

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Optional trailing content (e.g. a primary action), right-aligned on wider screens. */
  actions?: ReactNode;
  /**
   * Right-aligned SCOPE / SOURCE-style reference lines — what time window and
   * data source this page's numbers answer to. Use it wherever a page mixes
   * time scopes (e.g. always-YTD KPIs beside a period-filtered summary) so the
   * reader isn't left to guess.
   */
  scope?: ScopeItem[];
  className?: string;
};

/**
 * Tier-1 page header. Sits directly on the page background — NOT a card — so a
 * page title reads as a title, not a panel. Used at the top of every dashboard
 * overview and workspace page. The left bar is the same brand mark as the
 * logo's vertical bars and Panel's `BeamTick`, scaled up to full header
 * height — this is the tallest, loudest instance of that motif on the page.
 * The title is set in the display face (Archivo) — one of only two places
 * that face appears, alongside `StatCard` figures.
 */
export function PageHeader({
  title,
  description,
  actions,
  scope,
  className,
}: PageHeaderProps) {
  const hasSideContent = actions !== undefined || (scope && scope.length > 0);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex gap-3">
        <span aria-hidden="true" className="w-1.5 shrink-0 rounded-full bg-primary" />
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {hasSideContent ? (
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          {scope && scope.length > 0 ? (
            <dl className="space-y-1">
              {scope.map((item) => (
                <div
                  key={item.label}
                  className="flex items-baseline gap-2 sm:justify-end"
                >
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="text-xs font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
