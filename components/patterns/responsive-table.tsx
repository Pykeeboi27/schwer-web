"use client";

import { cn } from "@/lib/utils";
import type { KeyboardEvent, ReactNode } from "react";

type ResponsiveTableProps = {
  /** The full `<table>` element, shown from `md` up inside a scroll container. */
  table: ReactNode;
  /** Stacked card view shown below `md`. Usually a mapped list of `DataCard`s. */
  cards: ReactNode;
  className?: string;
};

/**
 * Renders a data table two ways: the existing `<table>` on `md+` screens, and a
 * stacked list of cards on phones — so wide business tables never force a
 * horizontal scroll on mobile. Each table keeps its own markup; it just maps its
 * rows into `DataCard`s for the `cards` slot.
 */
export function ResponsiveTable({ table, cards, className }: ResponsiveTableProps) {
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-lg border md:block">{table}</div>
      <div className="space-y-3 md:hidden">{cards}</div>
    </div>
  );
}

type DataCardProps = {
  /** Top row of the card — typically a title/code plus a status badge. */
  header?: ReactNode;
  /** Field rows, usually `DataField`s. */
  children?: ReactNode;
  /** Footer for actions or inline controls (buttons, inputs). */
  footer?: ReactNode;
  /** Makes the whole card activate (open a details dialog) on click/Enter/Space. */
  onActivate?: () => void;
  ariaLabel?: string;
  className?: string;
};

function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>, onActivate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}

export function DataCard({
  header,
  children,
  footer,
  onActivate,
  ariaLabel,
  className,
}: DataCardProps) {
  const interactive = Boolean(onActivate);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onActivate}
      onKeyDown={interactive ? (event) => onCardKeyDown(event, onActivate!) : undefined}
      className={cn(
        "rounded-lg border bg-card p-4 text-sm shadow-xs",
        interactive &&
          "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {header ? (
        <div className="mb-3 flex items-start justify-between gap-3">{header}</div>
      ) : null}
      {children ? <dl className="space-y-1.5">{children}</dl> : null}
      {footer ? <div className="mt-4 space-y-2">{footer}</div> : null}
    </div>
  );
}

type DataFieldProps = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
};

export function DataField({ label, value, className }: DataFieldProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

type TruncatedTextProps = {
  children: string;
  className?: string;
};

/**
 * Caps long text (item descriptions, etc.) at one line with an ellipsis,
 * exposing the full value as a native tooltip on hover/focus instead of
 * blowing out the table -- an alternative to just letting it scroll.
 */
export function TruncatedText({ children, className }: TruncatedTextProps) {
  return (
    <span
      title={children}
      className={cn("block max-w-[220px] truncate align-bottom", className)}
    >
      {children}
    </span>
  );
}
