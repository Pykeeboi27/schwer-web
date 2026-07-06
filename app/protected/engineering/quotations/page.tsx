import { CreateCostingQuotationDialog } from "@/components/dialogs/create-costing-quotation-dialog";
import { CostingHistoryTable } from "@/components/engineering/costing-history-table";
import { CostingQuotationsTable } from "@/components/engineering/costing-quotations-table";
import { PageHeader, Panel } from "@/components/patterns";
import { getEngineeringAccessRedirect } from "@/lib/engineering/access";
import {
  listCostingApprovedHistory,
  listCostingQuotations,
} from "@/lib/engineering/costing-quotations";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listClients } from "@/lib/sales/clients";
import { redirect } from "next/navigation";

export default async function EngineeringQuotationsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getEngineeringAccessRedirect(
    profile,
    "/protected/engineering/quotations",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  const isCostingEngineer = profile?.role === "costing_engineer";

  const [quotations, clients, history] = await Promise.all([
    listCostingQuotations(),
    isCostingEngineer ? listClients() : Promise.resolve([]),
    listCostingApprovedHistory(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Costing Quotations"
        description="Create and manage quotations during the costing phase. Submit for executive approval once cost and Drive link are in place."
        actions={
          isCostingEngineer ? (
            <CreateCostingQuotationDialog
              clients={clients.map((c) => ({
                id: c.id,
                companyName: c.companyName,
                isActive: c.isActive,
              }))}
            />
          ) : null
        }
      />

      <Panel>
        <CostingQuotationsTable
          quotations={quotations}
          currentUserId={profile?.id ?? ""}
          clients={clients.map((c) => ({
            id: c.id,
            companyName: c.companyName,
            isActive: c.isActive,
          }))}
        />
      </Panel>

      <Panel
        title="Approved History"
        description="Costing quotations that have been approved by the executive and handed over to Sales."
      >
        <CostingHistoryTable items={history} />
      </Panel>
    </div>
  );
}
