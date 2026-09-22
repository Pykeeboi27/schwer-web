import { cn } from "@/lib/utils";
import { statusLabel, statusToneClassName } from "./status-badge";

type StatusTileProps = {
  /** Known status key — resolves the tone and default label from the status registry. */
  status: string;
  value: number | string;
  /** Overrides the registry label. */
  label?: string;
  className?: string;
};

/**
 * Compact count tile for a status ("Pending 4"). Tone comes from the same
 * `--status-*` tokens as `StatusBadge`, so the two always agree. The tone class
 * sets the tile's tint and value color; the label opts back out to muted text.
 */
export function StatusTile({ status, value, label, className }: StatusTileProps) {
  return (
    <div className={cn("rounded-md border p-4", statusToneClassName(status), className)}>
      <p className="text-sm text-muted-foreground">{label ?? statusLabel(status)}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
