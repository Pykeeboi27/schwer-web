import { ExecutiveApprovalsTable } from "@/components/executive/approvals-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listPendingApprovalsForCurrentUser } from "@/lib/sales/quotations";
import { redirect } from "next/navigation";

export default async function ExecutiveApprovalsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(profile, "/protected/executive/approvals");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const pendingApprovals = await listPendingApprovalsForCurrentUser();
  const executiveApprovals = pendingApprovals.filter(
    (item) =>
      item.amount >= 3_000_000 &&
      (item.approverRole === "owner" || item.approverRole === "executive"),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Executive Approvals</CardTitle>
          <CardDescription>
            Review high-value quotations from Sales that require owner or executive approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Quotations with an amount of 3,000,000 or above are listed here when assigned to your
          account.
        </CardContent>
      </Card>

      <ExecutiveApprovalsTable
        items={executiveApprovals}
        currentUserRole={profile?.role ?? null}
      />
    </div>
  );
}
