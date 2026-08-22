import { EmptyState, Measure } from "@/components/patterns";
import { formatCurrency } from "@/lib/utils/number-format";

type BookedVsCollectedChartProps = {
  totalBooked: number;
  totalCollected: number;
};

/**
 * The flagship two-tone measure: booked (graphite) and collected (verdigris)
 * read as a pair against a shared capacity, so the gap between the two rows
 * *is* receivables exposure at a glance.
 */
export function BookedVsCollectedChart({
  totalBooked,
  totalCollected,
}: BookedVsCollectedChartProps) {
  if (totalBooked <= 0) {
    return (
      <EmptyState
        title="No purchase order data yet"
        description="Booked and collected totals will appear once purchase orders are approved."
      />
    );
  }

  const capacity = Math.max(totalBooked, totalCollected, 1);
  const collectedShare = Math.min((totalCollected / totalBooked) * 100, 100);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Total Booked</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(totalBooked)}
          </span>
        </div>
        <Measure
          value={totalBooked}
          capacity={capacity}
          tone="booked"
          minFillPercent={1.5}
          ariaLabel="Total booked"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Actual Collected</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(totalCollected)}
          </span>
        </div>
        <Measure
          value={totalCollected}
          capacity={capacity}
          tone="collected"
          minFillPercent={1.5}
          ariaLabel="Actual collected"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {collectedShare.toFixed(1)}% of booked value collected to date.
      </p>
    </div>
  );
}
