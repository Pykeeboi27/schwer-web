import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ClientSector = "commercial" | "industrial" | "solar";

// Same three tokens as the executive sector charts (--chart-1..3 in
// globals.css) so a sector reads as the same color everywhere it appears —
// this badge and components/sales/sector-performance-chart.tsx used to
// diverge on two independent hardcoded hex maps.
const SECTOR_META: Record<ClientSector, { label: string; className: string }> = {
  commercial: {
    label: "Commercial",
    className: "border-chart-1/30 bg-chart-1/10 text-chart-1",
  },
  industrial: {
    label: "Industrial",
    className: "border-chart-2/30 bg-chart-2/10 text-chart-2",
  },
  solar: {
    label: "Solar",
    className: "border-chart-3/30 bg-chart-3/10 text-chart-3",
  },
};

type SectorBadgeProps = {
  sector: ClientSector;
  className?: string;
};

/** Color-coded badge for a client's sector — one distinct tone per sector_enum value. */
export function SectorBadge({ sector, className }: SectorBadgeProps) {
  const meta = SECTOR_META[sector];

  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
