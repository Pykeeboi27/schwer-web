"use client";

import { ClientDetailsDialog } from "@/components/dialogs/client-details-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SalesClient } from "@/lib/sales/clients";
import { SearchX } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

type ClientsTableProps = {
  clients: SalesClient[];
};

type SectorFilter = "all" | SalesClient["sector"];

function searchMatches(client: SalesClient, query: string): boolean {
  if (!query) {
    return true;
  }

  const searchable = [
    client.clientCode,
    client.companyName,
    client.sector,
    client.contactPerson ?? "",
    client.email ?? "",
    client.phone ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

function onRowKeyDown(
  event: KeyboardEvent<HTMLTableRowElement>,
  onActivate: () => void,
): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>("all");
  const [selectedClient, setSelectedClient] = useState<SalesClient | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);

  const normalizedSearch = search.trim().toLowerCase();
  const hasActiveFilter = normalizedSearch.length > 0;
  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        const matchesSearch = searchMatches(client, normalizedSearch);
        const matchesSector = sectorFilter === "all" || client.sector === sectorFilter;

        return matchesSearch && matchesSector;
      }),
    [clients, normalizedSearch, sectorFilter],
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, code, contact, email, or phone"
          aria-label="Search clients"
          className="max-w-md"
        />
        <select
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value as SectorFilter)}
          aria-label="Filter clients by sector"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All sectors</option>
          <option value="commercial">Commercial</option>
          <option value="industrial">Industrial</option>
          <option value="solar">Solar</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Sector</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <SearchX className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">
                      {hasActiveFilter ? "No results match your search." : "No clients found."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hasActiveFilter
                        ? "Try different search terms or clear the filter to see all clients."
                        : "Create your first client to start tracking sales opportunities."}
                    </p>
                    {hasActiveFilter ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSearch("")}
                      >
                        Clear search
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className="cursor-pointer border-t hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`View client details for ${client.companyName}`}
                  onClick={() => {
                    setOpenInEditMode(false);
                    setSelectedClient(client);
                  }}
                  onKeyDown={(event) =>
                    onRowKeyDown(event, () => {
                      setOpenInEditMode(false);
                      setSelectedClient(client);
                    })
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs">{client.clientCode}</td>
                  <td className="px-3 py-2">{client.companyName}</td>
                  <td className="px-3 py-2 capitalize">{client.sector}</td>
                  <td className="px-3 py-2">{client.contactPerson ?? "-"}</td>
                  <td className="px-3 py-2">{client.email ?? "-"}</td>
                  <td className="px-3 py-2">{client.phone ?? "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenInEditMode(true);
                        setSelectedClient(client);
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ClientDetailsDialog
        open={selectedClient !== null}
        client={selectedClient}
        startInEditMode={openInEditMode}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClient(null);
            setOpenInEditMode(false);
          }
        }}
      />
    </>
  );
}
