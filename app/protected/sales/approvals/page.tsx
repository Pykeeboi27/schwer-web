import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { fetchPurchaseOrdersAction } from "@/app/protected/sales/purchase-orders/actions";
import { QuotationsTable } from "@/components/tables/quotations-table";
import { PurchaseOrdersTable } from "@/components/tables/purchase-orders-table";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { MarkSectionSeen } from "@/components/notifications/mark-section-seen";
import { PageHeader, Panel } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { listPendingApprovalsForCurrentUser } from "@/lib/sales/quotations";
import {
  listPendingPoApprovalsForCurrentUser,
  listPoPayments,
} from "@/lib/sales/purchase-orders";
import { redirect } from "next/navigation";

export default async function SalesApprovalsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(profile, "/protected/sales/approvals");

  if (redirectPath) {
    redirect(redirectPath);
  }

  if (profile?.role !== "sales_manager") {
    redirect("/protected/sales/quotations");
  }

  const [pendingApprovals, pendingPoApprovals, quotationsResponse, poResponse, payments] =
    await Promise.all([
      listPendingApprovalsForCurrentUser(),
      listPendingPoApprovalsForCurrentUser(),
      fetchQuotationsAction(profile?.department ?? undefined, profile?.role ?? undefined),
      fetchPurchaseOrdersAction(profile?.department ?? undefined),
      listPoPayments(),
    ]);

  const salesManagerApprovals = pendingApprovals.filter(
    (item) => item.approverRole === "sales_manager",
  );

  const salesManagerPoApprovals = pendingPoApprovals.filter(
    (item) => item.approverRole === "sales_manager",
  );

  // Cross-reference the thin pending-approval worklist against the full
  // records so the table/dialog can show complete detail (client, pricing
  // breakdown, payment terms, etc.) instead of just quotation #/subject/amount.
  const pendingQuotationIds = new Set(
    salesManagerApprovals.map((item) => item.quotationId),
  );
  const pendingPoIds = new Set(salesManagerPoApprovals.map((item) => item.poId));

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
      <MarkSectionSeen section="approvals" />
      <PageHeader
        title="Quotation Approvals"
        description="Quotations submitted by the sales team for your review. Approve to advance through the workflow, or reject to return them for correction."
      />

      <Panel
        title="Pending Quotations"
        description="Quotations awaiting your approval as sales manager. Click one to review full details, then approve or reject."
      >
        <QuotationsTable
          quotations={pendingQuotationsForApproval}
          currentUserId={profile?.id ?? ""}
          currentUserRole={profile?.role ?? null}
        />
      </Panel>

      <Panel
        title="Pending Purchase Orders"
        description="Purchase orders awaiting your approval as sales manager. Click one to review full details, then approve or reject."
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
