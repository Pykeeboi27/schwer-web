"use client";

import { QuotationsTable } from "@/components/tables/quotations-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { useMemo, useState } from "react";

type ExecutiveQuotationsViewProps = {
  quotations: SalesQuotation[];
  currentUserId: string;
  currentUserRole: string | null;
};

type OwnerOption = { id: string; name: string };
type ClientOption = { id: string; name: string };

function ownerOf(quotation: SalesQuotation): OwnerOption | null {
  const id = quotation.salesPersonId ?? quotation.preparedBy;
  const name = quotation.salesPersonName ?? quotation.preparedByName;
  if (!id) {
    return null;
  }
  return { id, name: name || "Unknown" };
}

function uniqueOptions(options: (OwnerOption | ClientOption | null)[]): OwnerOption[] {
  const byId = new Map<string, OwnerOption>();
  for (const option of options) {
    if (option) {
      byId.set(option.id, option);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function ExecutiveQuotationsView({
  quotations,
  currentUserId,
  currentUserRole,
}: ExecutiveQuotationsViewProps) {
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const ownerOptions = useMemo(
    () => uniqueOptions(quotations.map(ownerOf)),
    [quotations],
  );
  const clientOptions = useMemo(
    () =>
      uniqueOptions(
        quotations.map((q) => ({ id: q.clientId, name: q.clientName || "Unknown" })),
      ),
    [quotations],
  );

  const filtered = useMemo(() => {
    return quotations.filter((quotation) => {
      if (ownerFilter !== "all") {
        const owner = ownerOf(quotation);
        if (!owner || owner.id !== ownerFilter) {
          return false;
        }
      }
      if (clientFilter !== "all" && quotation.clientId !== clientFilter) {
        return false;
      }
      return true;
    });
  }, [quotations, ownerFilter, clientFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger
            className="w-full sm:w-[200px]"
            aria-label="Filter by sales owner"
          >
            <SelectValue placeholder="All sales owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sales owners</SelectItem>
            {ownerOptions.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filter by client">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clientOptions.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QuotationsTable
        quotations={filtered}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
