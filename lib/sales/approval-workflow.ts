// @deprecated This single-status state machine is NOT the workflow that
// drives the app -- the live approval engine is the quotation_approvals /
// po_approvals join tables (see lib/sales/quotations.ts,
// lib/sales/purchase-orders.ts, and the fn_sync_*_status_from_approvals
// triggers in schema.sql). Nothing in app/, lib/, or components/ imports
// determineNextQuotationStatus; only tests/unit/approval-workflow.test.ts and
// tests/unit/quotation-approval-workflow.test.ts exercise it. It still
// encodes the OLD sales_manager -> owner -> executive order and was
// intentionally NOT updated to sales_manager -> executive -> owner when that
// chain changed (migrations/0022_sequential_approval_chain.sql) -- do not
// treat this file as a source of truth for the approval order.
type WorkflowStatus =
  | "draft"
  | "pending_sales_manager"
  | "pending_owner"
  | "pending_executive"
  | "approved"
  | "rejected"
  | "closed";

type ApproverRole = "sales_manager" | "owner" | "executive";

function normalizeStatus(status: string): WorkflowStatus {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\[\]\s]+/g, "_")
    .replace(/__+/g, "_");

  if (normalized === "pending") {
    return "pending_sales_manager";
  }

  if (
    normalized === "draft" ||
    normalized === "pending_sales_manager" ||
    normalized === "pending_owner" ||
    normalized === "pending_executive" ||
    normalized === "approved" ||
    normalized === "rejected" ||
    normalized === "closed"
  ) {
    return normalized;
  }

  throw new Error(`Unsupported quotation status: ${status}`);
}

function normalizeRole(role: string): ApproverRole {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "sales_manager" ||
    normalized === "owner" ||
    normalized === "executive"
  ) {
    return normalized;
  }

  throw new Error(`Unsupported approver role: ${role}`);
}

export function determineNextQuotationStatus(
  currentStatus: string,
  userRole: string,
  quotationAmount: number,
): WorkflowStatus {
  const status = normalizeStatus(currentStatus);
  const role = normalizeRole(userRole);

  if (!Number.isFinite(quotationAmount) || quotationAmount <= 0) {
    throw new Error("Quotation amount must be greater than 0.");
  }

  if (status === "approved" || status === "rejected" || status === "closed") {
    return status;
  }

  if (status === "draft") {
    if (role !== "sales_manager") {
      throw new Error("Only sales_manager can move a draft quotation to approval.");
    }

    return "pending_sales_manager";
  }

  if (status === "pending_sales_manager") {
    if (role !== "sales_manager") {
      throw new Error(
        "Only sales_manager can approve this quotation at the current stage.",
      );
    }

    return quotationAmount >= 3_000_000 ? "pending_owner" : "approved";
  }

  if (status === "pending_owner") {
    if (role !== "owner") {
      throw new Error("Only owner can approve this quotation at the current stage.");
    }

    return "pending_executive";
  }

  if (status === "pending_executive") {
    if (role !== "executive") {
      throw new Error("Only executive can approve this quotation at the current stage.");
    }

    return "approved";
  }

  throw new Error(`Unsupported quotation status: ${currentStatus}`);
}
