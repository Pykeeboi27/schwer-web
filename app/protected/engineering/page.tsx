import { PageHeader, StatCard } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getEngineeringAccessRedirect } from "@/lib/engineering/access";
import { listCostingQuotations } from "@/lib/engineering/costing-quotations";
import { redirect } from "next/navigation";

export default async function EngineeringDashboardPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getEngineeringAccessRedirect(profile, "/protected/engineering");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const quotations = await listCostingQuotations();
  const draftCount = quotations.filter((q) => q.status === "draft").length;
  const pendingCount = quotations.filter((q) => q.status === "pending").length;
  const rejectedDrafts = quotations.filter(
    (q) => q.status === "draft" && Boolean(q.costingRejectionReason),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Engineering Dashboard"
        description="Start quotations with cost data and a Google Drive link, then submit them for executive costing approval."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Drafts" value={draftCount} />
        <StatCard label="Pending Costing Approval" value={pendingCount} />
        <StatCard label="Returned for Edits" value={rejectedDrafts} />
      </div>
    </div>
  );
}
