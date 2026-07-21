import { CostingApprovalHistoryTable } from "@/components/executive/costing-approval-history-table";
import { ExecutiveCostingApprovalsTable } from "@/components/executive/costing-approvals-table";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { MarkSectionRead } from "@/components/notifications/mark-section-read";
import { PageHeader, Panel } from "@/components/patterns";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import {
  listCostingApprovalHistory,
  listPendingCostingApprovals,
} from "@/lib/executive/costing-approvals";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { redirect } from "next/navigation";

export default async function ExecutiveCostingApprovalsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(
    profile,
    "/protected/executive/costing-approvals",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  const isExecutiveActor =
    profile?.role === "executive" && profile?.department === "executive";

  const [items, history] = isExecutiveActor
    ? await Promise.all([listPendingCostingApprovals(), listCostingApprovalHistory()])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["quotations", "quotation_items"]} />
      <MarkSectionRead section="costing_approvals" />
      <PageHeader
        title="Costing Approval"
        description={
          isExecutiveActor
            ? "Review costing engineers' quotations. Approve to hand the quotation over to Sales, or reject to send it back for edits. Use Close to dismiss a row from your view without changing its state."
            : "Review costing engineers' quotations. Only the Executive role can act on costing approvals."
        }
      />

      {isExecutiveActor ? (
        <Panel title="Pending Costing Approvals">
          <ExecutiveCostingApprovalsTable items={items} />
        </Panel>
      ) : null}

      {isExecutiveActor ? (
        <Panel
          title="Approval History"
          description="Past costing quotations that were approved or sent back for edits."
        >
          <CostingApprovalHistoryTable items={history} />
        </Panel>
      ) : null}
    </div>
  );
}
