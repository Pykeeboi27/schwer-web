import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ClientSector = "commercial" | "industrial" | "solar";

const SECTOR_META: Record<ClientSector, { label: string; className: string }> = {
  commercial: {
    label: "Commercial",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  industrial: {
    label: "Industrial",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  solar: {
    label: "Solar",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
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
