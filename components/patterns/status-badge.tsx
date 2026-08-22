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

// Every tone reads off the --status-* tokens in globals.css (single source of
// truth, shared with Callout) instead of raw Tailwind palette classes — a
// theme change now actually reaches these badges. Each token already carries
// its own light/dark value, so no `dark:` variant is needed here.
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-status-neutral/30 bg-status-neutral/10 text-status-neutral",
  pending: "border-status-pending/30 bg-status-pending/10 text-status-pending",
  success: "border-status-approved/30 bg-status-approved/10 text-status-approved",
  danger: "border-status-rejected/30 bg-status-rejected/10 text-status-rejected",
  muted: "border-status-neutral/20 bg-status-neutral/5 text-status-neutral",
  info: "border-status-info/30 bg-status-info/10 text-status-info",
  returned: "border-status-returned/30 bg-status-returned/10 text-status-returned",
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
