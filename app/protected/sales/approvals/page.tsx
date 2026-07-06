import { ExecutiveApprovalsTable } from "@/components/executive/approvals-table";
import { ExecutivePoApprovalsTable } from "@/components/executive/po-approvals-table";
import { PageHeader, Panel } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { listPendingApprovalsForCurrentUser } from "@/lib/sales/quotations";
import { listPendingPoApprovalsForCurrentUser } from "@/lib/sales/purchase-orders";
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

  const [pendingApprovals, pendingPoApprovals] = await Promise.all([
    listPendingApprovalsForCurrentUser(),
    listPendingPoApprovalsForCurrentUser(),
  ]);

  const salesManagerApprovals = pendingApprovals.filter(
    (item) => item.approverRole === "sales_manager",
  );

  const salesManagerPoApprovals = pendingPoApprovals.filter(
    (item) => item.approverRole === "sales_manager",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotation Approvals"
        description="Quotations submitted by the sales team for your review. Approve to advance through the workflow, or reject to return them for correction."
      />

      <Panel
        title="Pending Quotations"
        description="Quotations awaiting your approval as sales manager."
      >
        <ExecutiveApprovalsTable
          items={salesManagerApprovals}
          currentUserRole={profile?.role ?? null}
        />
      </Panel>

      <Panel
        title="Pending Purchase Orders"
        description="Purchase orders awaiting your approval as sales manager."
      >
        <ExecutivePoApprovalsTable
          items={salesManagerPoApprovals}
          currentUserRole={profile?.role ?? null}
        />
      </Panel>
    </div>
  );
}
