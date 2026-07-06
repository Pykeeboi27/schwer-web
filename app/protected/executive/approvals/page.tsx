import { ExecutiveApprovalsTable } from "@/components/executive/approvals-table";
import { ExecutivePoApprovalsTable } from "@/components/executive/po-approvals-table";
import { PageHeader, Panel } from "@/components/patterns";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listPendingApprovalsForCurrentUser } from "@/lib/sales/quotations";
import { listPendingPoApprovalsForCurrentUser } from "@/lib/sales/purchase-orders";
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

  const [pendingApprovals, pendingPoApprovals] = await Promise.all([
    listPendingApprovalsForCurrentUser(),
    listPendingPoApprovalsForCurrentUser(),
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Executive Approvals"
        description="Review high-value quotations from Sales that require owner or executive approval. Quotations of ₱3,000,000 or above appear here when assigned to your account."
      />

      <Panel title="Pending Quotations">
        <ExecutiveApprovalsTable
          items={executiveApprovals}
          currentUserRole={profile?.role ?? null}
        />
      </Panel>

      <Panel
        title="Purchase Order Approvals"
        description="High-value purchase orders converted from approved quotations that require owner or executive approval."
      >
        <ExecutivePoApprovalsTable
          items={executivePoApprovals}
          currentUserRole={profile?.role ?? null}
        />
      </Panel>
    </div>
  );
}
