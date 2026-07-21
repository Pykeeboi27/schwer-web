import { ExecutivePurchaseOrdersView } from "@/components/executive/executive-purchase-orders-view";
import { EmptyState, PageHeader, Panel } from "@/components/patterns";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { fetchPurchaseOrdersAction } from "@/app/protected/sales/purchase-orders/actions";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listPoPayments } from "@/lib/sales/purchase-orders";
import { redirect } from "next/navigation";

export default async function ExecutivePurchaseOrdersPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(
    profile,
    "/protected/executive/purchase-orders",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  // purchase_orders already grants executives/owners unrestricted SELECT
  // (po_executive_select, migrations/0002) -- no amount cap to work around here.
  const [poResponse, payments] = await Promise.all([
    fetchPurchaseOrdersAction(),
    listPoPayments(),
  ]);
  const purchaseOrders = poResponse.success ? (poResponse.data ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["purchase_orders", "po_approvals"]} />
      <PageHeader
        title="Purchase Orders"
        description="Every purchase order across Sales, regardless of amount or status."
      />

      <Panel>
        {poResponse.success ? (
          <ExecutivePurchaseOrdersView
            purchaseOrders={purchaseOrders}
            payments={payments}
            currentUserId={profile?.id ?? ""}
            currentUserRole={profile?.role ?? null}
          />
        ) : (
          <EmptyState
            title="Purchase orders unavailable"
            description="Please refresh the page or try again later."
          />
        )}
      </Panel>
    </div>
  );
}
