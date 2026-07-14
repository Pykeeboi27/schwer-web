import { cn } from "@/lib/utils";

type StatusCount = {
  label: string;
  count: number;
  barClassName: string;
};

type CostingStatusBreakdownProps = {
  draft: number;
  returned: number;
  pending: number;
  approved: number;
};

/**
 * Lightweight, dependency-free breakdown of costing counts by status: a
 * segmented bar plus a labeled legend. No chart library involved.
 */
export function CostingStatusBreakdown({
  draft,
  returned,
  pending,
  approved,
}: CostingStatusBreakdownProps) {
  const segments: StatusCount[] = [
    { label: "Draft", count: draft, barClassName: "bg-muted-foreground/40" },
    { label: "Returned", count: returned, barClassName: "bg-destructive" },
    { label: "Pending", count: pending, barClassName: "bg-amber-500" },
    { label: "Approved", count: approved, barClassName: "bg-emerald-500" },
  ];

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {total === 0 ? (
          <div className="h-full w-full bg-muted" />
        ) : (
          segments.map((segment) =>
            segment.count > 0 ? (
              <div
                key={segment.label}
                className={cn("h-full", segment.barClassName)}
                style={{ width: `${(segment.count / total) * 100}%` }}
              />
            ) : null,
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-sm">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", segment.barClassName)} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="ml-auto font-medium">{segment.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
