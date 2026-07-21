import { EmptyState } from "@/components/patterns";
import { formatCurrency } from "@/lib/utils/number-format";

type BookedVsCollectedChartProps = {
  totalBooked: number;
  totalCollected: number;
};

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

  const max = Math.max(totalBooked, totalCollected, 1);
  const bookedWidth = Math.max((totalBooked / max) * 100, 1.5);
  const collectedWidth = Math.max((totalCollected / max) * 100, 1.5);
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
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${bookedWidth}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Actual Collected</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(totalCollected)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${collectedWidth}%` }}
            aria-hidden
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {collectedShare.toFixed(1)}% of booked value collected to date.
      </p>
    </div>
  );
}
