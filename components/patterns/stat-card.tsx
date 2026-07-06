import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  /** Optional footer content (progress bar, delta, caption) shown under the value. */
  children?: ReactNode;
  /** Draws a subtle left rule in the brand color to mark the lead KPI. */
  accent?: boolean;
  /** "hero" promotes this to the single lead metric on a dashboard — bigger
   * value, thicker accent bar. Defaults to today's standard tier-2 card. */
  size?: "default" | "hero";
  className?: string;
};

/**
 * Tier-2 KPI card. The value is the loudest element: a sentence-case muted
 * label over a large tabular number. Canonical across the sales, executive, and
 * engineering overviews — no more three-different-ways KPI cards.
 */
export function StatCard({
  label,
  value,
  children,
  accent,
  size = "default",
  className,
}: StatCardProps) {
  const isHero = size === "hero";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-xs",
        isHero ? "p-5 sm:p-6" : "p-4 sm:p-5",
        accent &&
          (isHero ? "border-l-[6px] border-l-primary" : "border-l-4 border-l-primary"),
        className,
      )}
    >
      <p
        className={cn(
          "text-sm text-muted-foreground",
          isHero && "text-sm font-medium uppercase tracking-wide",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-semibold tabular-nums",
          isHero ? "text-4xl sm:text-5xl" : "text-3xl",
        )}
      >
        {value}
      </p>
      {children ? <div className={cn(isHero ? "mt-4" : "mt-3")}>{children}</div> : null}
    </div>
  );
}

type StatProgressProps = {
  /** 0–100. */
  percent: number;
  caption?: ReactNode;
  size?: "default" | "hero";
};

/** Progress meter for the lead KPI (e.g. revenue vs. annual target). */
export function StatProgress({ percent, caption, size = "default" }: StatProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const isHero = size === "hero";

  return (
    <div>
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted",
          isHero ? "h-2.5" : "h-2",
        )}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {caption ? (
        <p className={cn("mt-1.5 text-muted-foreground", isHero ? "text-sm" : "text-xs")}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}
