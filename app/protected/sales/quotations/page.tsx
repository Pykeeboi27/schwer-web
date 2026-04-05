import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { CreateQuotationDialog } from "@/components/dialogs/create-quotation-dialog";
import { QuotationsTable } from "@/components/tables/quotations-table";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listClients } from "@/lib/sales/clients";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { redirect } from "next/navigation";

export default async function SalesQuotationsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(profile, "/protected/sales/quotations");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const isSalesDepartment = profile?.department === "sales";

  const [response, clients] = await Promise.all([
    fetchQuotationsAction(profile?.department ?? undefined, profile?.role ?? undefined),
    isSalesDepartment ? listClients() : Promise.resolve([]),
  ]);

  const quotations = response.success ? response.data ?? [] : [];
  const pendingCount = quotations.filter((quotation) => quotation.status === "pending").length;
  const approvedCount = quotations.filter((quotation) => quotation.status === "approved").length;
  const rejectedCount = quotations.filter((quotation) => quotation.status === "rejected").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card p-5">
        <h1 className="text-2xl font-semibold">Quotations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review quotation details and process amount-based approvals for pending records.
        </p>
        {isSalesDepartment ? (
          <div className="mt-4">
            <CreateQuotationDialog clients={clients} />
          </div>
        ) : null}
      </div>

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
        {response.success ? (
          <QuotationsTable
            quotations={quotations}
            currentUserId={profile?.id ?? ""}
            currentUserRole={profile?.role ?? null}
            clients={clients}
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
