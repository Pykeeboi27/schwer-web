import { ExecutiveApprovalsTable } from "@/components/executive/approvals-table";
import { ExecutivePoApprovalsTable } from "@/components/executive/po-approvals-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-l-4 border-l-primary bg-card p-5 pl-5">
        <h1 className="text-2xl font-semibold">Quotation Approvals</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quotations submitted by the sales team for your review. Approve to advance through the
          workflow, or reject to return them for correction.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Quotations</CardTitle>
          <CardDescription>
            Quotations awaiting your approval as sales manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExecutiveApprovalsTable
            items={salesManagerApprovals}
            currentUserRole={profile?.role ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Purchase Orders</CardTitle>
          <CardDescription>
            Purchase orders awaiting your approval as sales manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExecutivePoApprovalsTable
            items={salesManagerPoApprovals}
            currentUserRole={profile?.role ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
