"use client";

import { PurchaseOrderDetailsDialog } from "@/components/dialogs/purchase-order-details-dialog";
import { Button } from "@/components/ui/button";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { FileText } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

type PurchaseOrdersTableProps = {
  purchaseOrders: SalesPurchaseOrder[];
  payments: SalesPoPayment[];
};

type SortBy = "poDate" | "poAmount";
type SortDirection = "asc" | "desc";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function sortedRows(
  purchaseOrders: SalesPurchaseOrder[],
  sortBy: SortBy,
  sortDirection: SortDirection,
): SalesPurchaseOrder[] {
  const sorted = [...purchaseOrders].sort((first, second) => {
    if (sortBy === "poAmount") {
      return first.poAmount - second.poAmount;
    }

    return new Date(first.poDate).getTime() - new Date(second.poDate).getTime();
  });

  if (sortDirection === "desc") {
    sorted.reverse();
  }

  return sorted;
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

export function PurchaseOrdersTable({
  purchaseOrders,
  payments,
}: PurchaseOrdersTableProps) {
  const [sortBy, setSortBy] = useState<SortBy>("poDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] =
    useState<string | null>(null);

  const orderedRows = useMemo(
    () => sortedRows(purchaseOrders, sortBy, sortDirection),
    [purchaseOrders, sortBy, sortDirection],
  );

  const selectedPurchaseOrder = useMemo(() => {
    if (!selectedPurchaseOrderId) {
      return null;
    }

    return purchaseOrders.find((purchaseOrder) => purchaseOrder.id === selectedPurchaseOrderId) ?? null;
  }, [purchaseOrders, selectedPurchaseOrderId]);

  const toggleSort = (targetSortBy: SortBy) => {
    if (sortBy === targetSortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(targetSortBy);
    setSortDirection("desc");
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Sort by:</span>
        <Button
          type="button"
          variant={sortBy === "poDate" ? "default" : "outline"}
          size="sm"
          onClick={() => toggleSort("poDate")}
        >
          Date {sortBy === "poDate" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
        </Button>
        <Button
          type="button"
          variant={sortBy === "poAmount" ? "default" : "outline"}
          size="sm"
          onClick={() => toggleSort("poAmount")}
        >
          Amount {sortBy === "poAmount" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">PO #</th>
              <th className="px-3 py-2 font-medium">Client Name</th>
              <th className="px-3 py-2 font-medium">Total Amount</th>
              <th className="px-3 py-2 font-medium">Collected Amount</th>
              <th className="px-3 py-2 font-medium">Progress</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">No purchase orders found.</p>
                    <p className="text-xs text-muted-foreground">
                      Create a purchase order to start tracking collections.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orderedRows.map((purchaseOrder) => {
                const progressPercent = Math.min(
                  100,
                  Math.round((purchaseOrder.recognizedAmount / purchaseOrder.poAmount) * 100),
                );

                return (
                  <tr
                    key={purchaseOrder.id}
                    className="cursor-pointer border-t hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                    role="button"
                    tabIndex={0}
                    aria-label={`View purchase order ${purchaseOrder.poNumber}`}
                    onClick={() => setSelectedPurchaseOrderId(purchaseOrder.id)}
                    onKeyDown={(event) =>
                      onRowKeyDown(event, () => setSelectedPurchaseOrderId(purchaseOrder.id))
                    }
                  >
                    <td className="px-3 py-2 font-mono text-xs">{purchaseOrder.poNumber}</td>
                    <td className="px-3 py-2">{purchaseOrder.clientName}</td>
                    <td className="px-3 py-2">{formatCurrency(purchaseOrder.poAmount)}</td>
                    <td className="px-3 py-2">
                      {formatCurrency(purchaseOrder.recognizedAmount)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="w-36">
                        <p className="mb-1 text-xs text-muted-foreground">
                          {purchaseOrder.recognizedAmount.toFixed(2)} / {purchaseOrder.poAmount.toFixed(2)}
                        </p>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{purchaseOrder.paymentStatus}</td>
                    <td className="px-3 py-2">
                      {new Date(purchaseOrder.poDate).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PurchaseOrderDetailsDialog
        open={selectedPurchaseOrder !== null}
        purchaseOrder={selectedPurchaseOrder}
        payments={payments}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPurchaseOrderId(null);
          }
        }}
      />
    </>
  );
}