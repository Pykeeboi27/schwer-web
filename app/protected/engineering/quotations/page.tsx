import { CreateCostingQuotationDialog } from "@/components/dialogs/create-costing-quotation-dialog";
import { CostingQuotationsTable } from "@/components/engineering/costing-quotations-table";
import { getEngineeringAccessRedirect } from "@/lib/engineering/access";
import { listCostingQuotations } from "@/lib/engineering/costing-quotations";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listClients } from "@/lib/sales/clients";
import { redirect } from "next/navigation";

export default async function EngineeringQuotationsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getEngineeringAccessRedirect(profile, "/protected/engineering/quotations");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const isCostingEngineer = profile?.role === "costing_engineer";

  const [quotations, clients] = await Promise.all([
    listCostingQuotations(),
    isCostingEngineer ? listClients() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card p-5">
        <h1 className="text-2xl font-semibold">Costing Quotations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create and manage quotations during the costing phase. Submit for executive approval once
          cost and Drive link are in place.
        </p>
        {isCostingEngineer ? (
          <div className="mt-4">
            <CreateCostingQuotationDialog
              clients={clients.map((c) => ({
                id: c.id,
                companyName: c.companyName,
                isActive: c.isActive,
              }))}
            />
          </div>
        ) : null}
      </div>

      <section className="rounded-md border bg-card p-5">
        <CostingQuotationsTable
          quotations={quotations}
          currentUserId={profile?.id ?? ""}
          clients={clients.map((c) => ({
            id: c.id,
            companyName: c.companyName,
            isActive: c.isActive,
          }))}
        />
      </section>
    </div>
  );
}
