import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { QuotationsTable } from "@/components/tables/quotations-table";
import { ReadyForPurchaseOrderTable } from "@/components/tables/ready-for-purchase-order-table";
import { ReadyForQuotationTable } from "@/components/tables/ready-for-quotation-table";
import { PageHeader, Panel } from "@/components/patterns";
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

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Pending",
            value: pendingCount,
            className:
              "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
            valueClassName: "text-amber-700 dark:text-amber-300",
          },
          {
            label: "Approved",
            value: approvedCount,
            className:
              "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
            valueClassName: "text-green-700 dark:text-green-300",
          },
          {
            label: "Rejected",
            value: rejectedCount,
            className: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
            valueClassName: "text-red-700 dark:text-red-300",
          },
        ].map((item) => (
          <div key={item.label} className={`rounded-md border p-3 ${item.className}`}>
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${item.valueClassName}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {isSalesDepartment ? (
        <>
          <Panel
            title="My Quotations"
            description="Quotations assigned to you. Fully editable while in draft or re-opened for a PO."
          >
            {response.success ? (
              <QuotationsTable
                quotations={myQuotations}
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
            title="Company Quotations"
            description="Quotations assigned to other sales people. Read-only unless you're an approver."
          >
            {response.success ? (
              <QuotationsTable
                quotations={companyQuotations}
                currentUserId={profile?.id ?? ""}
                currentUserRole={profile?.role ?? null}
              />
            ) : (
              <p className="text-sm text-destructive">
                {response.error ?? "Failed to load quotations."}
              </p>
            )}
          </Panel>
        </>
      ) : (
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
      )}
    </div>
  );
}
