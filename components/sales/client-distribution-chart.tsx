import type { ClientDistributionBar } from "@/lib/sales/dashboard-charts";
import { formatCurrency } from "@/lib/utils/number-format";

type ClientDistributionChartProps = {
  bars: ClientDistributionBar[];
  /** Cap the number of clients shown; the rest are grouped into "Others". */
  limit?: number;
};

export function ClientDistributionChart({ bars, limit = 8 }: ClientDistributionChartProps) {
  if (bars.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No approved quotations yet to distribute across clients.
      </div>
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

  const max = Math.max(...rows.map((row) => row.totalAmount), 1);

  return (
    <ul className="space-y-3 text-sm">
      {rows.map((row) => {
        const width = Math.max((row.totalAmount / max) * 100, 1.5);
        return (
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
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${width}%` }}
                aria-hidden
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
