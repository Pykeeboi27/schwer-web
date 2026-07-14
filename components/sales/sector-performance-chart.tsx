import { EmptyState } from "@/components/patterns";
import type { SectorPerformanceSlice } from "@/lib/sales/dashboard-charts";
import { formatCurrency } from "@/lib/utils/number-format";

type SectorPerformanceChartProps = {
  slices: SectorPerformanceSlice[];
};

const SECTOR_COLORS: Record<SectorPerformanceSlice["sector"], string> = {
  commercial: "hsl(var(--chart-1))",
  industrial: "hsl(var(--chart-2))",
  solar: "hsl(var(--chart-4))",
};

const RADIUS = 80;
const STROKE = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SectorPerformanceChart({ slices }: SectorPerformanceChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.totalAmount, 0);

  if (slices.length === 0 || total <= 0) {
    return (
      <EmptyState
        title="No sector data yet"
        description="No approved quotations yet to break down by sector."
      />
    );
  }

  let offsetAccumulator = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <svg
        viewBox="0 0 200 200"
        className="h-44 w-44 shrink-0 -rotate-90"
        role="img"
        aria-label="Sector performance donut chart"
      >
        {slices.map((slice) => {
          const fraction = slice.totalAmount / total;
          const dash = fraction * CIRCUMFERENCE;
          const segment = (
            <circle
              key={slice.sector}
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke={SECTOR_COLORS[slice.sector]}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-offsetAccumulator}
            />
          );
          offsetAccumulator += dash;
          return segment;
        })}
      </svg>

      <ul className="w-full min-w-0 flex-1 space-y-3 text-sm">
        {slices.map((slice) => {
          const share = total > 0 ? (slice.totalAmount / total) * 100 : 0;
          return (
            <li key={slice.sector} className="min-w-0">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: SECTOR_COLORS[slice.sector] }}
                    aria-hidden
                  />
                  <span className="truncate font-medium">{slice.label}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {share.toFixed(1)}%
                </span>
              </div>
              <div className="mt-0.5 truncate pl-5 text-muted-foreground">
                {formatCurrency(slice.totalAmount)} · {slice.count}{" "}
                {slice.count === 1 ? "quote" : "quotes"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
