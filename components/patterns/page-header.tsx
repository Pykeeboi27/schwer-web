import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Optional trailing content (e.g. a primary action), right-aligned on wider screens. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Tier-1 page header. Sits directly on the page background — NOT a card — so a
 * page title reads as a title, not a panel. Used at the top of every dashboard
 * overview and workspace page. The left bar is the same brand mark as the
 * logo's vertical bars and Panel's `BeamTick`, scaled up to full header
 * height — this is the tallest, loudest instance of that motif on the page.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
