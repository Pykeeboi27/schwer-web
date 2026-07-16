import { fetchRequestsForQuotationAction } from "@/app/protected/sales/request-for-quotation/actions";
import { CreateRequestForQuotationDialog } from "@/components/dialogs/create-request-for-quotation-dialog";
import { RequestForQuotationTable } from "@/components/tables/request-for-quotation-table";
import { PageHeader, Panel } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { listClients } from "@/lib/sales/clients";
import { redirect } from "next/navigation";

export default async function RequestForQuotationPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(
    profile,
    "/protected/sales/request-for-quotation",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  const [response, clients] = await Promise.all([
    fetchRequestsForQuotationAction(),
    listClients(),
  ]);

  const requests = response.success ? (response.data ?? []) : [];
  const clientOptions = clients
    .filter((client) => client.isActive)
    .map((client) => ({ id: client.id, companyName: client.companyName }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Request for Quotation"
        description="Raise a request with the items and quantities Engineering needs to cost. Once Engineering costs every line and the executive approves it, the request appears in Quotations for pricing."
        actions={<CreateRequestForQuotationDialog clients={clientOptions} />}
      />

      <Panel>
        {response.success ? (
          <RequestForQuotationTable requests={requests} />
        ) : (
          <p className="text-sm text-destructive">
            {response.error ?? "Failed to load requests for quotation."}
          </p>
        )}
      </Panel>
    </div>
  );
}
