"use client";

import { ClientDetailsDialog } from "@/components/dialogs/client-details-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
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
    client.tin ?? "",
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

  const openClient = (client: SalesClient, editMode: boolean) => {
    setOpenInEditMode(editMode);
    setSelectedClient(client);
  };

  const emptyState = (
    <EmptyState
      icon={SearchX}
      title={hasActiveFilter ? "No results match your search." : "No clients found."}
      description={
        hasActiveFilter
          ? "Try different search terms or clear the filter to see all clients."
          : "Create your first client to start tracking sales opportunities."
      }
    >
      {hasActiveFilter ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setSearch("")}>
          Clear search
        </Button>
      ) : null}
    </EmptyState>
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, code, contact, email, or phone"
          aria-label="Search clients"
          className="sm:max-w-md"
        />
        <Select
          value={sectorFilter}
          onValueChange={(value) => setSectorFilter(value as SectorFilter)}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filter clients by sector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sectors</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="industrial">Industrial</SelectItem>
            <SelectItem value="solar">Solar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ResponsiveTable
        table={
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Sector</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7}>{emptyState}</td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="cursor-pointer border-t hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                    role="button"
                    tabIndex={0}
                    aria-label={`View client details for ${client.companyName}`}
                    onClick={() => openClient(client, false)}
                    onKeyDown={(event) =>
                      onRowKeyDown(event, () => openClient(client, false))
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
                          openClient(client, true);
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
        }
        cards={
          filteredClients.length === 0 ? (
            <div className="rounded-lg border">{emptyState}</div>
          ) : (
            filteredClients.map((client) => (
              <DataCard
                key={client.id}
                onActivate={() => openClient(client, false)}
                ariaLabel={`View client details for ${client.companyName}`}
                header={
                  <>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{client.companyName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {client.clientCode}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                      {client.sector}
                    </span>
                  </>
                }
                footer={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      openClient(client, true);
                    }}
                  >
                    Edit
                  </Button>
                }
              >
                <DataField label="Contact" value={client.contactPerson ?? "-"} />
                <DataField label="Email" value={client.email ?? "-"} />
                <DataField label="Phone" value={client.phone ?? "-"} />
              </DataCard>
            ))
          )
        }
      />

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
