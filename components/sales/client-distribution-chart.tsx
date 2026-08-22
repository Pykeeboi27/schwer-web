import { EmptyState, Measure } from "@/components/patterns";
import type { ClientDistributionBar } from "@/lib/sales/dashboard-charts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/number-format";

type ClientDistributionChartProps = {
  bars: ClientDistributionBar[];
  /** Cap the number of clients shown; the rest are grouped into "Others". */
  limit?: number;
  /** Constrain the list to a max height with internal scroll, instead of
   * letting it stretch the card indefinitely. Useful when showing all clients. */
  scrollable?: boolean;
};

export function ClientDistributionChart({
  bars,
  limit = 8,
  scrollable = false,
}: ClientDistributionChartProps) {
  if (bars.length === 0) {
    return (
      <EmptyState
        title="No client distribution yet"
        description="No approved quotations yet to distribute across clients."
      />
    );
  }

  const visible = bars.slice(0, limit);
  const overflow = bars.slice(limit);

  const rows = [...visible];
  if (overflow.length > 0) {
    rows.push({
      clientId: "__others__",
      clientName: `Others (${overflow.length})`,
      totalAmount: overflow.reduce((sum, bar) => sum + bar.totalAmount, 0),
      count: overflow.reduce((sum, bar) => sum + bar.count, 0),
    });
  }

  const capacity = Math.max(...rows.map((row) => row.totalAmount), 1);

  return (
    <ul
      className={cn("space-y-3 text-sm", scrollable && "max-h-80 overflow-y-auto pr-1")}
    >
      {rows.map((row) => (
        <li key={row.clientId} className="space-y-1">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium" title={row.clientName}>
              {row.clientName}
            </span>
            <span className="shrink-0 whitespace-nowrap text-muted-foreground">
              {formatCurrency(row.totalAmount)}
              <span className="ml-2">
                ({row.count} {row.count === 1 ? "quote" : "quotes"})
              </span>
            </span>
          </div>
          <Measure
            value={row.totalAmount}
            capacity={capacity}
            tone="booked"
            minFillPercent={1.5}
            ariaLabel={`${row.clientName}: ${formatCurrency(row.totalAmount)}`}
          />
        </li>
      ))}
    </ul>
  );
}
