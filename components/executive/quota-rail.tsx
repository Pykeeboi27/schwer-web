import { Measure } from "@/components/patterns";

export type QuotaRailProps = {
  /** Null when no quota has been set for this person/year yet. */
  quotaAmount: number | null;
  achieved: number;
  year: number;
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

const DAY_MS = 1000 * 60 * 60 * 24;

/** Fraction (0-1) of the year elapsed as of referenceDate — the pace marker's position. */
function getPaceFraction(year: number, referenceDate: Date): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  if (referenceDate < yearStart) {
    return 0;
  }

  if (referenceDate >= yearEnd) {
    return 1;
  }

  return (
    (referenceDate.getTime() - yearStart.getTime()) /
    (yearEnd.getTime() - yearStart.getTime())
  );
}

/**
 * Quota tracking's caller onto the signature `Measure`: a rail that reads
 * against *pace*, not just amount. A plain bar can only say "60% there" —
 * this one also says whether 60% is good news (May) or bad news (November).
 * The moving pace marker carries that second fact; the fixed cap tick is the
 * 100% reference the marker is judged against.
 */
export function QuotaRail({
  quotaAmount,
  achieved,
  year,
  referenceDate,
  canEdit = false,
}: QuotaRailProps) {
  if (quotaAmount === null || quotaAmount <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {canEdit
          ? `No quota set for ${year} yet — set one above.`
          : `No quota set for ${year}.`}
      </p>
    );
  }

  const today = referenceDate ?? new Date();
  const isCurrentYear = today.getFullYear() === year;
  const pacePercent = getPaceFraction(year, today) * 100;
  const percent = (achieved / quotaAmount) * 100;

  const status: "ahead" | "close" | "behind" =
    percent >= pacePercent ? "ahead" : percent >= pacePercent * 0.8 ? "close" : "behind";

  const daysLeft = isCurrentYear
    ? Math.max(
        0,
        Math.ceil((new Date(year + 1, 0, 1).getTime() - today.getTime()) / DAY_MS),
      )
    : null;

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
      <Measure
        value={achieved}
        capacity={quotaAmount}
        tone={status}
        capTick
        pace={isCurrentYear ? pacePercent : undefined}
        animate
        ariaLabel={`${year} quota progress`}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {formatCurrency(achieved)} of {formatCurrency(quotaAmount)} ·{" "}
        {Math.round(percent)}% · {statusLabel}
      </p>
    </div>
  );
}
