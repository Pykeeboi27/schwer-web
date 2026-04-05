import { CreateClientDialog } from "@/components/dialogs/create-client-dialog";
import { ClientsTable } from "@/components/tables/clients-table";
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
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card p-5">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage client profiles, generate unique codes, and open full details from the table.
        </p>
        <div className="mt-4">
          <CreateClientDialog />
        </div>
      </div>

      <section className="rounded-md border bg-card p-5">
        <ClientsTable clients={clients} />
      </section>
    </div>
  );
}
