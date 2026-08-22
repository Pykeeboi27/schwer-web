import { EmptyState, Measure } from "@/components/patterns";
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

  const capacity = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3 text-sm">
          <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
            {bar.label}
          </span>
          <Measure
            value={bar.value}
            capacity={capacity}
            tone="booked"
            className="flex-1"
            ariaLabel={`${bar.label}: ${formatCurrency(bar.value)}`}
          />
          <span className="w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {formatCurrency(bar.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
