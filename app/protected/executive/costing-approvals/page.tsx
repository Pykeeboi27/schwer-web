import { ExecutiveCostingApprovalsTable } from "@/components/executive/costing-approvals-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { listPendingCostingApprovals } from "@/lib/executive/costing-approvals";
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

  const items = isExecutiveActor ? await listPendingCostingApprovals() : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Costing Approval</CardTitle>
          <CardDescription>
            Review costing engineers&apos; quotations. Approve to hand the quotation over to Sales
            for further information, or reject to send it back for edits.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isExecutiveActor
            ? "Use Close to dismiss a row from your view without changing its state."
            : "Only the Executive role can act on costing approvals."}
        </CardContent>
      </Card>

      {isExecutiveActor ? (
        <ExecutiveCostingApprovalsTable items={items} />
      ) : null}
    </div>
  );
}
