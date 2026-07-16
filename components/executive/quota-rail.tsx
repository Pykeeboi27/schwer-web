"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export type QuotaRailProps = {
  /** Null when no quota has been set for this person/month yet. */
  quotaAmount: number | null;
  achieved: number;
  year: number;
  /** 1-12. */
  month: number;
  monthLabel: string;
  /** Defaults to now; pass a fixed date in tests/stories. */
  referenceDate?: Date;
  /** Softens the empty-state copy into an invitation to act, for target editors. */
  canEdit?: boolean;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Fraction (0-1) of the month elapsed as of referenceDate — the pace marker's position. */
function getPaceFraction(year: number, month: number, referenceDate: Date): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  if (referenceDate < monthStart) {
    return 0;
  }

  if (referenceDate > monthEnd) {
    return 1;
  }

  return Math.min(referenceDate.getDate(), daysInMonth) / daysInMonth;
}

/**
 * The signature element for quota tracking: a progress rail that reads
 * against *pace*, not just amount. A plain bar can only say "60% there" — this
 * one also says whether 60% is good news (12 days into the month) or bad news
 * (25 days in). The moving pace marker carries that second fact; the fixed
 * tick at the right edge is the 100% reference the marker is judged against.
 */
export function QuotaRail({
  quotaAmount,
  achieved,
  year,
  month,
  monthLabel,
  referenceDate,
  canEdit = false,
}: QuotaRailProps) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (quotaAmount === null || quotaAmount <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {canEdit
          ? `No quota set for ${monthLabel} yet — set one below.`
          : `No quota set for ${monthLabel}.`}
      </p>
    );
  }

  const today = referenceDate ?? new Date();
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const pacePercent = getPaceFraction(year, month, today) * 100;
  const percent = (achieved / quotaAmount) * 100;
  const fillPercent = Math.min(100, percent);

  const status: "ahead" | "close" | "behind" =
    percent >= pacePercent ? "ahead" : percent >= pacePercent * 0.8 ? "close" : "behind";

  const fillColor = {
    ahead: "bg-green-500",
    close: "bg-amber-500",
    behind: "bg-red-500",
  }[status];

  const daysLeft = isCurrentMonth ? Math.max(0, daysInMonth - today.getDate()) : null;

  let statusLabel: string;
  if (percent >= 100) {
    const surplus = achieved - quotaAmount;
    statusLabel = surplus > 0 ? `${formatCurrency(surplus)} over quota` : "Quota hit";
  } else if (status === "ahead") {
    statusLabel = daysLeft !== null ? `On pace · ${daysLeft} days left` : "On pace";
  } else {
    const gap = quotaAmount - achieved;
    statusLabel =
      daysLeft !== null
        ? `${formatCurrency(gap)} to go · ${daysLeft} days left`
        : `${formatCurrency(gap)} to go`;
  }

  return (
    <div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(fillPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${monthLabel} quota progress`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            fillColor,
          )}
          style={{ width: grown ? `${fillPercent}%` : "0%" }}
        />
        {/* Fixed 100% reference tick. */}
        <div
          className="absolute inset-y-0 right-0 w-px bg-foreground/70"
          aria-hidden="true"
        />
        {/* Pace marker: where the month's elapsed time says achievement "should" be. */}
        {isCurrentMonth ? (
          <div
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${Math.min(99, pacePercent)}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {formatCurrency(achieved)} of {formatCurrency(quotaAmount)} ·{" "}
        {Math.round(percent)}% · {statusLabel}
      </p>
    </div>
  );
}
