import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  /** Optional footer content (progress bar, delta, caption) shown under the value. */
  children?: ReactNode;
  /** Draws a subtle left rule in the brand color to mark the lead KPI. */
  accent?: boolean;
  className?: string;
};

/**
 * Tier-2 KPI card. The value is the loudest element: a sentence-case muted
 * label over a large tabular number. Canonical across the sales, executive, and
 * engineering overviews — no more three-different-ways KPI cards.
 */
export function StatCard({ label, value, children, accent, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5",
        accent && "border-l-4 border-l-primary",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

type StatProgressProps = {
  /** 0–100. */
  percent: number;
  caption?: ReactNode;
};

/** Progress meter for the lead KPI (e.g. revenue vs. annual target). */
export function StatProgress({ percent, caption }: StatProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
      </div>
      {caption ? <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
