import { fetchPurchaseOrdersAction } from "@/app/protected/sales/purchase-orders/actions";
import { CreatePoDialog } from "@/components/dialogs/create-po-dialog";
import { PurchaseOrdersTable } from "@/components/tables/purchase-orders-table";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listClients } from "@/lib/sales/clients";
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
  const redirectPath = getSalesAccessRedirect(profile, "/protected/sales/purchase-orders");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const [response, clients, payments] = await Promise.all([
    fetchPurchaseOrdersAction(profile?.department ?? undefined),
    listClients(),
    listPoPayments(),
  ]);

  const purchaseOrders = response.success ? response.data ?? [] : [];

  const totals = purchaseOrders.reduce(
    (accumulator, purchaseOrder) => {
      return {
        closed: accumulator.closed + purchaseOrder.poAmount,
        recognized: accumulator.recognized + purchaseOrder.recognizedAmount,
      };
    },
    { closed: 0, recognized: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card p-5">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create purchase orders, track collections, and monitor recognized revenue.
        </p>
        <div className="mt-4">
          <CreatePoDialog clients={clients} />
        </div>
      </div>

      <section className="grid gap-3 rounded-md border bg-card p-5 sm:grid-cols-2">
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Closed Sales</p>
          <p className="mt-1 text-xl font-semibold">{formatCurrency(totals.closed)}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Recognized Sales</p>
          <p className="mt-1 text-xl font-semibold">{formatCurrency(totals.recognized)}</p>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5">
        {response.success ? (
          <PurchaseOrdersTable purchaseOrders={purchaseOrders} payments={payments} />
        ) : (
          <p className="text-sm text-destructive">
            {response.error ?? "Failed to load purchase orders."}
          </p>
        )}
      </section>
    </div>
  );
}
