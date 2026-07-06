import { fetchPurchaseOrdersAction } from "@/app/protected/sales/purchase-orders/actions";
import { PurchaseOrdersTable } from "@/components/tables/purchase-orders-table";
import { PageHeader, Panel, StatCard } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { listPoPayments } from "@/lib/sales/purchase-orders";
import { redirect } from "next/navigation";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function SalesPurchaseOrdersPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(
    profile,
    "/protected/sales/purchase-orders",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  const [response, payments] = await Promise.all([
    fetchPurchaseOrdersAction(profile?.department ?? undefined),
    listPoPayments(),
  ]);

  const purchaseOrders = response.success ? (response.data ?? []) : [];

  // Closed/recognized sales reflect fully-approved POs only.
  const totals = purchaseOrders.reduce(
    (accumulator, purchaseOrder) => {
      if (purchaseOrder.status !== "approved") {
        return accumulator;
      }
      return {
        closed: accumulator.closed + purchaseOrder.poAmount,
        recognized: accumulator.recognized + purchaseOrder.recognizedAmount,
      };
    },
    { closed: 0, recognized: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase Orders"
        description="Purchase orders converted from approved quotations. Pending POs await approval; once approved, track collections here as payments come in."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Closed Sales" value={formatCurrency(totals.closed)} accent />
        <StatCard label="Recognized Sales" value={formatCurrency(totals.recognized)} />
      </div>

      <Panel>
        {response.success ? (
          <PurchaseOrdersTable
            purchaseOrders={purchaseOrders}
            payments={payments}
            currentUserId={profile?.id ?? ""}
            currentUserRole={profile?.role ?? null}
          />
        ) : (
          <p className="text-sm text-destructive">
            {response.error ?? "Failed to load purchase orders."}
          </p>
        )}
      </Panel>
    </div>
  );
}
