import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Single source of truth for status → color/label across the app. Replaces the
 * status-color maps that were previously redeclared (and diverged) in the
 * quotations, purchase-order, and costing tables.
 *
 * Pass a known `status` key to get the default tone + label, or pass `tone`
 * directly for an ad-hoc status. `label` always overrides the default wording
 * (e.g. "Pending" vs "Pending Approval").
 */
export type StatusTone =
  "neutral" | "pending" | "success" | "danger" | "muted" | "info" | "returned";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  success:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  muted:
    "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  returned:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
};

type StatusMeta = { tone: StatusTone; label: string };

const STATUS_REGISTRY: Record<string, StatusMeta> = {
  // Quotation / PO / costing approval statuses
  draft: { tone: "neutral", label: "Draft" },
  pending: { tone: "pending", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  cancelled: { tone: "muted", label: "Cancelled" },
  closed: { tone: "info", label: "Closed" },
  returned: { tone: "returned", label: "Returned for Edits" },
  // Payment statuses
  unpaid: { tone: "neutral", label: "Unpaid" },
  partial: { tone: "pending", label: "Partial" },
  paid: { tone: "success", label: "Paid" },
  overdue: { tone: "danger", label: "Overdue" },
};

/** Default display label for a known status key (falls back to the key itself). */
export function statusLabel(status: string): string {
  return STATUS_REGISTRY[status]?.label ?? status;
}

export type StatusBadgeProps = {
  /** Known status key — looks up the default tone + label from the registry. */
  status?: string;
  /** Explicit tone, for statuses not in the registry. Overrides the registry tone. */
  tone?: StatusTone;
  /** Override the displayed text (e.g. "Pending Approval" instead of "Pending"). */
  label?: ReactNode;
  className?: string;
};

export function StatusBadge({ status, tone, label, className }: StatusBadgeProps) {
  const meta = status ? STATUS_REGISTRY[status] : undefined;
  const resolvedTone = tone ?? meta?.tone ?? "neutral";
  const content = label ?? meta?.label ?? status ?? "";

  return (
    <Badge variant="outline" className={cn(TONE_CLASSES[resolvedTone], className)}>
      {content}
    </Badge>
  );
}
