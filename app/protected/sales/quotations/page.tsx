import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { QuotationsTable } from "@/components/tables/quotations-table";
import { ReadyForPurchaseOrderTable } from "@/components/tables/ready-for-purchase-order-table";
import { ReadyForQuotationTable } from "@/components/tables/ready-for-quotation-table";
import { PageHeader, Panel, StatCard } from "@/components/patterns";
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
    (quotation) => quotation.status === "draft" && quotation.costingApprovedAt !== null,
  );

  // Approved + client PO recorded, but not yet converted: ready to make a PO.
  const isReadyForPurchaseOrder = (quotation: (typeof quotations)[number]) =>
    quotation.status === "approved" &&
    quotation.clientConfirmedAt !== null &&
    quotation.convertedPoId === null;

  const readyForPurchaseOrder = quotations.filter(isReadyForPurchaseOrder);

  // Counts cover every non-draft quotation still owned by this page (before the
  // ready-for-PO rows are split out), so the "Approved" tile keeps counting them.
  const statsQuotations = quotations.filter(
    (quotation) =>
      quotation.status !== "draft" &&
      // Once the converted PO is fully approved, the quotation moves to the PO module.
      quotation.convertedPoStatus !== "approved",
  );

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
  const rejectedCount = statsQuotations.filter(
    (quotation) => quotation.status === "rejected",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotations"
        description="Quotations originate in engineering and reach this page after executive approves the costing. Add the sales details, then submit through the approval workflow."
      />

      {isSalesDepartment ? (
        <Panel
          title="Ready for Quotation"
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
      ) : null}

      {isSalesDepartment ? (
        <Panel
          title="Ready for Purchase Order"
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
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={pendingCount} />
        <StatCard label="Approved" value={approvedCount} />
        <StatCard label="Rejected" value={rejectedCount} />
      </div>

      <Panel title="Quotations">
        {response.success ? (
          <QuotationsTable
            quotations={activeQuotations}
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
  );
}
