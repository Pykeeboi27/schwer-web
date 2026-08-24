import { fetchPurchaseOrdersAction } from "@/app/protected/sales/purchase-orders/actions";
import { EncodeExistingPoDialog } from "@/components/dialogs/encode-existing-po-dialog";
import { PurchaseOrdersTable } from "@/components/tables/purchase-orders-table";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { MarkSectionRead } from "@/components/notifications/mark-section-read";
import { PageHeader, Panel, StatCard } from "@/components/patterns";
import { getPeriodDateRange } from "@/lib/executive/period";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import {
  canEncodeExistingPurchaseOrders,
  getSalesAccessRedirect,
} from "@/lib/sales/access";
import { fetchBookedPoRows, sumBookedRevenue } from "@/lib/sales/booked-revenue";
import { listClients } from "@/lib/sales/clients";
import { listPoPayments } from "@/lib/sales/purchase-orders";
import { listSalesDepartmentProfiles } from "@/lib/sales/sales-people";
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

  const ytdRange = getPeriodDateRange("ytd");

  const [response, payments, clients, salesPeople, bookedRows] = await Promise.all([
    fetchPurchaseOrdersAction(profile?.department ?? undefined),
    listPoPayments(),
    listClients(),
    listSalesDepartmentProfiles(),
    // Closed/Recognized Sales share the same canonical YTD definition as every
    // other "booked revenue" card in the app -- see lib/sales/booked-revenue.ts.
    // The table below still shows each row's own (line-item-repriced) amount;
    // only these two header totals are sourced from the shared definition.
    fetchBookedPoRows(ytdRange.startDate, ytdRange.endDate),
  ]);

  const purchaseOrders = response.success ? (response.data ?? []) : [];
  const clientOptions = clients
    .filter((client) => client.isActive)
    .map((client) => ({ id: client.id, companyName: client.companyName }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  const totals = {
    closed: sumBookedRevenue(bookedRows),
    recognized: bookedRows.reduce(
      (sum, row) => sum + Number(row.recognized_amount ?? 0),
      0,
    ),
  };

  const isSalesDepartment = profile?.department === "sales";

  // Sales users get their own created purchase orders split from the rest of
  // the department's; owner/executive keep a single combined table.
  const myPurchaseOrders = purchaseOrders.filter(
    (purchaseOrder) => purchaseOrder.createdBy === profile?.id,
  );
  const companyPurchaseOrders = purchaseOrders.filter(
    (purchaseOrder) => purchaseOrder.createdBy !== profile?.id,
  );

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["purchase_orders", "po_approvals"]} />
      <MarkSectionRead section="purchase_orders" />
      <PageHeader
        title="Purchase Orders"
        description="Purchase orders converted from approved quotations. Pending POs await approval; once approved, track collections here as payments come in."
        actions={
          canEncodeExistingPurchaseOrders(profile) ? (
            <EncodeExistingPoDialog
              clients={clientOptions}
              salesPeople={salesPeople}
              userId={profile?.id ?? ""}
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Closed Sales (YTD)"
          value={formatCurrency(totals.closed)}
          accent
        />
        <StatCard
          label="Recognized Sales (YTD)"
          value={formatCurrency(totals.recognized)}
        />
      </div>

      {isSalesDepartment ? (
        <>
          <Panel
            title="My Purchase Orders"
            description="Purchase orders you created. Record collections and resubmit rejected POs here."
          >
            {response.success ? (
              <PurchaseOrdersTable
                purchaseOrders={myPurchaseOrders}
                payments={payments}
                currentUserId={profile?.id ?? ""}
                currentUserRole={profile?.role ?? null}
                salesPeople={salesPeople}
                pageSize={25}
              />
            ) : (
              <p className="text-sm text-destructive">
                {response.error ?? "Failed to load purchase orders."}
              </p>
            )}
          </Panel>

          <Panel
            title="Company Purchase Orders"
            description="Purchase orders created by other sales people. Collections can only be recorded by the owner."
          >
            {response.success ? (
              <PurchaseOrdersTable
                purchaseOrders={companyPurchaseOrders}
                payments={payments}
                currentUserId={profile?.id ?? ""}
                currentUserRole={profile?.role ?? null}
                salesPeople={salesPeople}
                pageSize={25}
              />
            ) : (
              <p className="text-sm text-destructive">
                {response.error ?? "Failed to load purchase orders."}
              </p>
            )}
          </Panel>
        </>
      ) : (
        <Panel>
          {response.success ? (
            <PurchaseOrdersTable
              purchaseOrders={purchaseOrders}
              payments={payments}
              currentUserId={profile?.id ?? ""}
              currentUserRole={profile?.role ?? null}
              salesPeople={salesPeople}
              pageSize={25}
            />
          ) : (
            <p className="text-sm text-destructive">
              {response.error ?? "Failed to load purchase orders."}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
