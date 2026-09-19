import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { QuotationsScopePanel } from "@/components/sales/quotations-scope-panel";
import { QuotationsTable } from "@/components/tables/quotations-table";
import { ReadyForPurchaseOrderTable } from "@/components/tables/ready-for-purchase-order-table";
import { ReadyForQuotationTable } from "@/components/tables/ready-for-quotation-table";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { MarkSectionRead } from "@/components/notifications/mark-section-read";
import { BeamTick, PageHeader, Panel, StatusTile } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { redirect } from "next/navigation";

export default async function SalesQuotationsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(profile, "/protected/sales/quotations");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const isSalesDepartment = profile?.department === "sales";

  const response = await fetchQuotationsAction(
    profile?.department ?? undefined,
    profile?.role ?? undefined,
  );

  const quotations = response.success ? (response.data ?? []) : [];

  const readyForQuotation = quotations.filter(
    (quotation) =>
      quotation.status === "draft" &&
      quotation.costingApprovedAt !== null &&
      quotation.salesPersonId === profile?.id,
  );

  // Approved + client PO recorded, but not yet converted: ready to make a PO.
  const isReadyForPurchaseOrder = (quotation: (typeof quotations)[number]) =>
    quotation.status === "approved" &&
    quotation.clientConfirmedAt !== null &&
    quotation.convertedPoId === null;

  const readyForPurchaseOrder = quotations.filter(isReadyForPurchaseOrder);

  // Counts cover every non-draft quotation still owned by this page (before the
  // ready-for-PO rows are split out), so the "Approved" tile keeps counting them.
  // Closed quotations (converted to a PO) stay visible here too, regardless of
  // how far the linked PO's own approval has progressed.
  const statsQuotations = quotations.filter((quotation) => quotation.status !== "draft");

  // The main table excludes rows surfaced in the "Ready for Purchase Order" section.
  const activeQuotations = statsQuotations.filter(
    (quotation) => !isReadyForPurchaseOrder(quotation),
  );

  const pendingCount = statsQuotations.filter(
    (quotation) => quotation.status === "pending",
  ).length;
  const approvedCount = statsQuotations.filter(
    (quotation) => quotation.status === "approved",
  ).length;
  const closedCount = statsQuotations.filter(
    (quotation) => quotation.status === "closed",
  ).length;
  const rejectedCount = statsQuotations.filter(
    (quotation) => quotation.status === "rejected",
  ).length;

  // Sales users get their own assigned quotations split from the rest of the
  // department's; owner/executive keep a single combined table.
  const myQuotations = activeQuotations.filter(
    (quotation) => quotation.salesPersonId === profile?.id,
  );
  const companyQuotations = activeQuotations.filter(
    (quotation) => quotation.salesPersonId !== profile?.id,
  );

  return (
    <div className="flex flex-col gap-8">
      <RealtimeRefresh tables={["quotations", "quotation_approvals"]} />
      <MarkSectionRead section="quotations" />
      <PageHeader
        title="Quotations"
        description="Quotations originate in engineering and reach this page after executive approves the costing. Add the sales details, then submit through the approval workflow."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusTile status="pending" value={pendingCount} />
        <StatusTile status="approved" value={approvedCount} />
        <StatusTile status="closed" value={closedCount} />
        <StatusTile status="rejected" value={rejectedCount} />
      </div>

      {isSalesDepartment ? (
        <div className="flex flex-col gap-4">
          <Panel
            title={
              <BeamTick>{`Ready for Quotation (${readyForQuotation.length})`}</BeamTick>
            }
            description="Costing quotations approved by the executive. Add the margin, payment terms, and lead time, then submit for sales approval."
          >
            {response.success ? (
              <ReadyForQuotationTable
                quotations={readyForQuotation}
                currentUserId={profile?.id ?? ""}
                currentUserRole={profile?.role ?? null}
              />
            ) : (
              <p className="text-sm text-destructive">
                {response.error ?? "Failed to load quotations."}
              </p>
            )}
          </Panel>

          <Panel
            title={
              <BeamTick>{`Ready for Purchase Order (${readyForPurchaseOrder.length})`}</BeamTick>
            }
            description="Approved quotations with a recorded client PO. Review the pricing, then convert to a purchase order."
          >
            {response.success ? (
              <ReadyForPurchaseOrderTable
                quotations={readyForPurchaseOrder}
                currentUserId={profile?.id ?? ""}
                currentUserRole={profile?.role ?? null}
              />
            ) : (
              <p className="text-sm text-destructive">
                {response.error ?? "Failed to load quotations."}
              </p>
            )}
          </Panel>
        </div>
      ) : null}

      {!response.success ? (
        <Panel title="Quotations">
          <p className="text-sm text-destructive">
            {response.error ?? "Failed to load quotations."}
          </p>
        </Panel>
      ) : isSalesDepartment ? (
        <QuotationsScopePanel
          myQuotations={myQuotations}
          companyQuotations={companyQuotations}
          currentUserId={profile?.id ?? ""}
          currentUserRole={profile?.role ?? null}
        />
      ) : (
        <Panel title="Quotations">
          <QuotationsTable
            quotations={activeQuotations}
            currentUserId={profile?.id ?? ""}
            currentUserRole={profile?.role ?? null}
          />
        </Panel>
      )}
    </div>
  );
}
