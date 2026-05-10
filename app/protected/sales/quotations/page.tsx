import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { QuotationsTable } from "@/components/tables/quotations-table";
import { ReadyForQuotationTable } from "@/components/tables/ready-for-quotation-table";
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

  const quotations = response.success ? response.data ?? [] : [];

  const readyForQuotation = quotations.filter(
    (quotation) => quotation.status === "draft" && quotation.costingApprovedAt !== null,
  );
  const activeQuotations = quotations.filter((quotation) => quotation.status !== "draft");

  const pendingCount = activeQuotations.filter((quotation) => quotation.status === "pending").length;
  const approvedCount = activeQuotations.filter((quotation) => quotation.status === "approved").length;
  const rejectedCount = activeQuotations.filter((quotation) => quotation.status === "rejected").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card p-5">
        <h1 className="text-2xl font-semibold">Quotations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quotations originate in engineering and reach this page after executive approves the
          costing. Add the sales details, then submit through the approval workflow.
        </p>
      </div>

      {isSalesDepartment ? (
        <section className="rounded-md border bg-card p-5">
          <h2 className="mb-1 text-lg font-semibold">Ready for Quotation</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Costing quotations approved by the executive. Add the margin, payment terms, and lead
            time, then submit for sales approval.
          </p>
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
        </section>
      ) : null}

      <section className="grid gap-3 rounded-md border bg-card p-5 sm:grid-cols-3">
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Pending</p>
          <p className="mt-1 text-xl font-semibold">{pendingCount}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Approved</p>
          <p className="mt-1 text-xl font-semibold">{approvedCount}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs uppercase text-muted-foreground">Rejected</p>
          <p className="mt-1 text-xl font-semibold">{rejectedCount}</p>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Quotations</h2>
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
      </section>
    </div>
  );
}
