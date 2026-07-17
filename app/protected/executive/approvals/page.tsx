import { PageHeader, Panel } from "@/components/patterns";
import { QuotationsTable } from "@/components/tables/quotations-table";
import { PurchaseOrdersTable } from "@/components/tables/purchase-orders-table";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { fetchPurchaseOrdersAction } from "@/app/protected/sales/purchase-orders/actions";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listPendingApprovalsForCurrentUser } from "@/lib/sales/quotations";
import {
  listPendingPoApprovalsForCurrentUser,
  listPoPayments,
} from "@/lib/sales/purchase-orders";
import { redirect } from "next/navigation";

export default async function ExecutiveApprovalsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(
    profile,
    "/protected/executive/approvals",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  const [pendingApprovals, pendingPoApprovals, quotationsResponse, poResponse, payments] =
    await Promise.all([
      listPendingApprovalsForCurrentUser(),
      listPendingPoApprovalsForCurrentUser(),
      fetchQuotationsAction(profile?.department ?? undefined, profile?.role ?? undefined),
      fetchPurchaseOrdersAction(profile?.department ?? undefined),
      listPoPayments(),
    ]);

  const executiveApprovals = pendingApprovals.filter(
    (item) =>
      item.amount >= 3_000_000 &&
      (item.approverRole === "owner" || item.approverRole === "executive"),
  );
  const executivePoApprovals = pendingPoApprovals.filter(
    (item) =>
      item.amount >= 3_000_000 &&
      (item.approverRole === "owner" || item.approverRole === "executive"),
  );

  // Cross-reference the thin pending-approval worklist against the full records
  // so the table/dialog can show complete detail (client, pricing breakdown,
  // payment terms, etc.) instead of just quotation #/subject/amount.
  const pendingQuotationIds = new Set(executiveApprovals.map((item) => item.quotationId));
  const pendingPoIds = new Set(executivePoApprovals.map((item) => item.poId));

  const quotations = quotationsResponse.success ? (quotationsResponse.data ?? []) : [];
  const purchaseOrders = poResponse.success ? (poResponse.data ?? []) : [];

  const pendingQuotationsForApproval = quotations.filter((quotation) =>
    pendingQuotationIds.has(quotation.id),
  );
  const pendingPurchaseOrdersForApproval = purchaseOrders.filter((purchaseOrder) =>
    pendingPoIds.has(purchaseOrder.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh
        tables={["quotations", "quotation_approvals", "purchase_orders", "po_approvals"]}
      />
      <PageHeader
        title="Executive Approvals"
        description="Review high-value quotations from Sales that require owner or executive approval. Quotations of ₱3,000,000 or above appear here when assigned to your account."
      />

      <Panel title="Pending Quotations">
        <QuotationsTable
          quotations={pendingQuotationsForApproval}
          currentUserId={profile?.id ?? ""}
          currentUserRole={profile?.role ?? null}
        />
      </Panel>

      <Panel
        title="Purchase Order Approvals"
        description="High-value purchase orders converted from approved quotations that require owner or executive approval."
      >
        <PurchaseOrdersTable
          purchaseOrders={pendingPurchaseOrdersForApproval}
          payments={payments}
          currentUserId={profile?.id ?? ""}
          currentUserRole={profile?.role ?? null}
        />
      </Panel>
    </div>
  );
}
