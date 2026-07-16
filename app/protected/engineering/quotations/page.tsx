import { CostingHistoryTable } from "@/components/engineering/costing-history-table";
import { CostingQuotationsTable } from "@/components/engineering/costing-quotations-table";
import { PageHeader, Panel } from "@/components/patterns";
import { getEngineeringAccessRedirect } from "@/lib/engineering/access";
import {
  listCostingApprovedHistory,
  listCostingQuotations,
} from "@/lib/engineering/costing-quotations";
import { listSalesPeople } from "@/lib/engineering/sales-people";
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

  const [quotations, history, salesPeople, clients] = await Promise.all([
    listCostingQuotations(),
    listCostingApprovedHistory(),
    listSalesPeople(),
    listClients(),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    isActive: c.isActive,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Costing Quotations"
        description="Requests for quotation raised by Sales. Set the unit cost for every item, attach a Google Drive link, then submit for executive approval."
      />

      <Panel>
        <CostingQuotationsTable
          quotations={quotations}
          clients={clientOptions}
          salesPeople={salesPeople}
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
