"use client";

import { PurchaseOrderDetailsDialog } from "@/components/dialogs/purchase-order-details-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { FileText, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

type PurchaseOrdersTableProps = {
  purchaseOrders: SalesPurchaseOrder[];
  payments: SalesPoPayment[];
};

type SortBy = "approvedAt" | "poAmount";
type SortDirection = "asc" | "desc";
type PaymentStatusFilter = "all" | SalesPurchaseOrder["paymentStatus"];

const PAYMENT_STATUS_LABELS: Record<SalesPurchaseOrder["paymentStatus"], string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

const PAYMENT_STATUS_CLASSES: Record<SalesPurchaseOrder["paymentStatus"], string> = {
  unpaid: "border-slate-200 bg-slate-50 text-slate-600",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
};

const ALL_PAYMENT_STATUSES: SalesPurchaseOrder["paymentStatus"][] = [
  "unpaid",
  "partial",
  "paid",
  "overdue",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function PaymentStatusBadge({ status }: { status: SalesPurchaseOrder["paymentStatus"] }) {
  return (
    <Badge className={PAYMENT_STATUS_CLASSES[status]} variant="outline">
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

function sortedRows(
  purchaseOrders: SalesPurchaseOrder[],
  sortBy: SortBy,
  sortDirection: SortDirection,
): SalesPurchaseOrder[] {
  const sorted = [...purchaseOrders].sort((first, second) => {
    if (sortBy === "poAmount") return first.poAmount - second.poAmount;
    const firstApproved = first.approvedAt ? new Date(first.approvedAt).getTime() : 0;
    const secondApproved = second.approvedAt ? new Date(second.approvedAt).getTime() : 0;
    return firstApproved - secondApproved;
  });
  if (sortDirection === "desc") sorted.reverse();
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

export function PurchaseOrdersTable({ purchaseOrders, payments }: PurchaseOrdersTableProps) {
  const [sortBy, setSortBy] = useState<SortBy>("approvedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");

  const filteredAndSorted = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let filtered = purchaseOrders;

    if (query) {
      filtered = filtered.filter(
        (po) =>
          po.clientName.toLowerCase().includes(query) ||
          po.poNumber.toLowerCase().includes(query) ||
          (po.subject ?? "").toLowerCase().includes(query),
      );
    }

    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter((po) => po.paymentStatus === paymentStatusFilter);
    }

    return sortedRows(filtered, sortBy, sortDirection);
  }, [purchaseOrders, searchQuery, paymentStatusFilter, sortBy, sortDirection]);

  const selectedPurchaseOrder = useMemo(() => {
    if (!selectedPurchaseOrderId) return null;
    return purchaseOrders.find((po) => po.id === selectedPurchaseOrderId) ?? null;
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
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, quotation #, or subject…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <Button
            type="button"
            variant={paymentStatusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setPaymentStatusFilter("all")}
          >
            All
          </Button>
          {ALL_PAYMENT_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              variant={paymentStatusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentStatusFilter(s)}
            >
              {PAYMENT_STATUS_LABELS[s]}
            </Button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">Sort:</span>
          <Button
            type="button"
            variant={sortBy === "approvedAt" ? "default" : "outline"}
            size="sm"
            onClick={() => toggleSort("approvedAt")}
          >
            Date {sortBy === "approvedAt" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
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
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Quotation #</th>
              <th className="px-3 py-2 font-medium">Client Name</th>
              <th className="px-3 py-2 font-medium">Total Amount</th>
              <th className="px-3 py-2 font-medium">Collected Amount</th>
              <th className="px-3 py-2 font-medium">Progress</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">No purchase orders found.</p>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery || paymentStatusFilter !== "all"
                        ? "Try adjusting your search or filter."
                        : "Approved quotations will appear here for collection tracking."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((purchaseOrder) => {
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
                          {purchaseOrder.recognizedAmount.toFixed(2)} /{" "}
                          {purchaseOrder.poAmount.toFixed(2)}
                        </p>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <PaymentStatusBadge status={purchaseOrder.paymentStatus} />
                    </td>
                    <td className="px-3 py-2">
                      {purchaseOrder.approvedAt
                        ? new Date(purchaseOrder.approvedAt).toLocaleDateString()
                        : "—"}
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
          if (!open) setSelectedPurchaseOrderId(null);
        }}
      />
    </>
  );
}
