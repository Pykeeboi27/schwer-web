import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Measure } from "./measure";

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
 * Tier-2 KPI card. The value is the loudest element: an eyebrow-style muted
 * label over a large tabular figure set in the display face (Archivo) — the
 * one place besides the page title that face is allowed to appear. Canonical
 * across the sales, executive, and engineering overviews.
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
          isHero && "text-[0.6875rem] font-semibold uppercase tracking-[0.18em]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display font-semibold tabular-nums tracking-[-0.02em]",
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

/**
 * Progress meter for the lead KPI (e.g. revenue vs. annual target). A thin
 * wrapper over `Measure` (`value = percent`, `capacity = 100`) that keeps its
 * original, simpler percent-based API intact for callers.
 */
export function StatProgress({ percent, caption, size = "default" }: StatProgressProps) {
  const isHero = size === "hero";

  return (
    <div>
      <Measure
        value={percent}
        capacity={100}
        size={size}
        ariaLabel={typeof caption === "string" ? caption : "Progress"}
      />
      {caption ? (
        <p className={cn("mt-1.5 text-muted-foreground", isHero ? "text-sm" : "text-xs")}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}
