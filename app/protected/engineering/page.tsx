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
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card p-5">
        <h1 className="text-2xl font-semibold">Engineering Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start quotations with cost data and a Google Drive link, then submit them for executive
          costing approval.
        </p>
      </div>

      <section className="grid gap-3 rounded-md border bg-card p-5 sm:grid-cols-3">
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Drafts</p>
          <p className="mt-1 text-xl font-semibold">{draftCount}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Pending Costing Approval</p>
          <p className="mt-1 text-xl font-semibold">{pendingCount}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Returned for Edits</p>
          <p className="mt-1 text-xl font-semibold">{rejectedDrafts}</p>
        </div>
      </section>
    </div>
  );
}
