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
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No revenue data available for this period.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3 text-sm">
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{bar.label}</span>
          <div className="relative flex-1 overflow-hidden rounded-full bg-muted" style={{ height: "10px" }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
              style={{ width: `${(bar.value / max) * 100}%` }}
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
