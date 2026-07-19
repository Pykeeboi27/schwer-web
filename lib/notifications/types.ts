// Mirrors notification_type_enum / notification_section_enum in schema.sql
// (see migrations/0011_notifications.sql for the introducing migration,
// 0012/0013 for the engineering-module additions, 0014/0015 for the
// costing-cost-updated notification, and 0016/0017 for notifying engineering
// on costing approval too).

export type NotificationType =
  | "quotation_approval_requested"
  | "quotation_approved"
  | "quotation_rejected"
  | "po_approval_requested"
  | "po_approved"
  | "po_rejected"
  | "costing_approval_requested"
  | "costing_approved"
  | "costing_rejected"
  | "costing_quotation_received"
  | "costing_quotation_returned"
  | "costing_cost_updated"
  | "costing_quotation_approved";

/** One value per nav tab that can show an "unseen changes" dot. */
export type NotificationSection =
  | "request_for_quotation"
  | "quotations"
  | "purchase_orders"
  | "approvals"
  | "costing_approvals"
  | "engineering_quotations";

export type NotificationEntityType = "quotation" | "purchase_order";

export type Notification = {
  id: string;
  type: NotificationType;
  section: NotificationSection;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  body: string | null;
  link: string;
  actorName: string | null;
  readAt: string | null;
  seenAt: string | null;
  createdAt: string;
};
