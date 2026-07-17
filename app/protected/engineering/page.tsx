import { CostingStatusBreakdown } from "@/components/engineering/costing-status-breakdown";
import { RecentCostingsPanel } from "@/components/engineering/recent-costings-panel";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { PageHeader, Panel, StatCard } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getEngineeringAccessRedirect } from "@/lib/engineering/access";
import { listCostingQuotations } from "@/lib/engineering/costing-quotations";
import { listSalesPeople } from "@/lib/engineering/sales-people";
import { formatCurrency } from "@/lib/utils/number-format";
import { listClients } from "@/lib/sales/clients";
import { redirect } from "next/navigation";

export default async function EngineeringDashboardPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getEngineeringAccessRedirect(profile, "/protected/engineering");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const [quotations, clients, salesPeople] = await Promise.all([
    listCostingQuotations(),
    listClients(),
    listSalesPeople(),
  ]);

  const draftCount = quotations.filter(
    (q) => q.status === "draft" && !q.costingRejectionReason,
  ).length;
  const rejectedDrafts = quotations.filter(
    (q) => q.status === "draft" && Boolean(q.costingRejectionReason),
  ).length;
  const pendingCount = quotations.filter((q) => q.status === "pending").length;
  const approvedCount = quotations.filter((q) => q.status === "approved").length;
  const totalDirectCost = quotations.reduce((sum, q) => sum + (q.cost ?? 0), 0);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    isActive: c.isActive,
  }));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["quotations"]} />
      <PageHeader
        title="Engineering Dashboard"
        description="Set the unit cost for each item on a Sales-raised request for quotation, attach a Google Drive link, then submit for executive costing approval."
      />

      <StatCard
        label="Pending Costing Approval"
        value={pendingCount}
        accent
        size="hero"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Costings" value={quotations.length} />
        <StatCard label="Drafts" value={draftCount} />
        <StatCard label="Returned for Edits" value={rejectedDrafts} />
        <StatCard label="Approved" value={approvedCount} />
      </div>

      <StatCard
        label="Total Direct Cost (All Costings)"
        value={formatCurrency(totalDirectCost)}
      />

      <Panel title="Status Breakdown">
        <CostingStatusBreakdown
          draft={draftCount}
          returned={rejectedDrafts}
          pending={pendingCount}
          approved={approvedCount}
        />
      </Panel>

      <Panel
        title="Recent Costings"
        description="The most recently created costing quotations. Click one to view details."
      >
        <RecentCostingsPanel
          quotations={quotations}
          clients={clientOptions}
          salesPeople={salesPeople}
        />
      </Panel>
    </div>
  );
}
