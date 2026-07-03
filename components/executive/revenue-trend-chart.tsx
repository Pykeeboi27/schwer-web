import { EmptyState } from "@/components/patterns";
import { formatCurrency } from "@/lib/utils/number-format";

type TrendBar = {
  label: string;
  value: number;
};

type RevenueTrendChartProps = {
  data: TrendBar[];
};

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <EmptyState
        title="No revenue data"
        description="No revenue data available for this period."
      />
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3 text-sm">
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
            {bar.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(bar.value / max) * 100}%` }}
              aria-hidden
            />
          </div>
          <span className="w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {formatCurrency(bar.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
