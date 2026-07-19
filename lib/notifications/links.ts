import type { NotificationSection, NotificationType } from "@/lib/notifications/types";

/**
 * Pure type -> section mapping. The concrete per-row `link` and `section` are
 * always computed and stored by the DB triggers (migrations/0011_notifications.sql)
 * at insert time, so this is not read on the hot path — it exists as the
 * single source of truth for what each notification type *should* link to,
 * used by the UI as a fallback/label lookup and covered by unit tests so a
 * newly added enum value can't silently fall through unmapped.
 */
export function sectionForType(type: NotificationType): NotificationSection {
  switch (type) {
    case "quotation_approval_requested":
    case "po_approval_requested":
      return "approvals";
    case "costing_approval_requested":
      return "costing_approvals";
    case "quotation_approved":
    case "quotation_rejected":
      return "quotations";
    case "po_approved":
    case "po_rejected":
      return "purchase_orders";
    case "costing_approved":
    case "costing_rejected":
      return "request_for_quotation";
    case "costing_quotation_received":
    case "costing_quotation_returned":
    case "costing_quotation_approved":
      return "engineering_quotations";
    case "costing_cost_updated":
      return "request_for_quotation";
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unmapped notification type: ${exhaustiveCheck}`);
    }
  }
}

/** Bell badge count label: hides at 0, caps the display at "9+". */
export function formatUnreadCount(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return count > 9 ? "9+" : String(count);
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Short relative-time label ("Just now", "5m ago", "3h ago", "2d ago"). */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;

  if (!Number.isFinite(diffMs) || diffMs < MINUTE_MS) {
    return "Just now";
  }
  if (diffMs < HOUR_MS) {
    return `${Math.floor(diffMs / MINUTE_MS)}m ago`;
  }
  if (diffMs < DAY_MS) {
    return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  }
  if (diffMs < 7 * DAY_MS) {
    return `${Math.floor(diffMs / DAY_MS)}d ago`;
  }

  // Explicit locale: deterministic output regardless of the runtime's ICU/locale config.
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
