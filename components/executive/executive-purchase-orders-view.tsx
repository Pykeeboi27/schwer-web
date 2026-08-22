"use client";

import { PurchaseOrdersTable } from "@/components/tables/purchase-orders-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 25;

type ExecutivePurchaseOrdersViewProps = {
  purchaseOrders: SalesPurchaseOrder[];
  payments: SalesPoPayment[];
  currentUserId: string;
  currentUserRole: string | null;
};

type FilterOption = { id: string; name: string };

function uniqueOptions(options: FilterOption[]): FilterOption[] {
  const byId = new Map<string, FilterOption>();
  for (const option of options) {
    byId.set(option.id, option);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function ExecutivePurchaseOrdersView({
  purchaseOrders,
  payments,
  currentUserId,
  currentUserRole,
}: ExecutivePurchaseOrdersViewProps) {
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const ownerOptions = useMemo(
    () =>
      uniqueOptions(
        purchaseOrders.map((po) => ({
          id: po.createdBy,
          name: po.createdByName || "Unknown",
        })),
      ),
    [purchaseOrders],
  );
  const clientOptions = useMemo(
    () =>
      uniqueOptions(
        purchaseOrders.map((po) => ({
          id: po.clientId,
          name: po.clientName || "Unknown",
        })),
      ),
    [purchaseOrders],
  );

  const filtered = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (ownerFilter !== "all" && po.createdBy !== ownerFilter) {
        return false;
      }
      if (clientFilter !== "all" && po.clientId !== clientFilter) {
        return false;
      }
      return true;
    });
  }, [purchaseOrders, ownerFilter, clientFilter]);

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

      {/* Pagination lives inside the table so it slices *after* the table's own
          search, status filter, and sort -- paginating here would scope those
          to the current page. */}
      <PurchaseOrdersTable
        purchaseOrders={filtered}
        payments={payments}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        pageSize={DEFAULT_PAGE_SIZE}
      />
    </div>
  );
}
