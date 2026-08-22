import { CreateClientDialog } from "@/components/dialogs/create-client-dialog";
import { ClientsTable } from "@/components/tables/clients-table";
import { PageHeader, Panel } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { fetchClients } from "@/lib/sales/clients";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { redirect } from "next/navigation";

export default async function SalesClientsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(profile, "/protected/sales/clients");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const clients = await fetchClients();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Manage client profiles, generate unique codes, and open full details from the table."
        actions={<CreateClientDialog existingNames={clients.map((c) => c.companyName)} />}
      />

      <Panel>
        <ClientsTable clients={clients} pageSize={25} />
      </Panel>
    </div>
  );
}
