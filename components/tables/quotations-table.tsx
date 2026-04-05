"use client";

import { QuotationDetailsDialog } from "@/components/dialogs/quotation-details-dialog";
import { Button } from "@/components/ui/button";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { FileText } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

type QuotationsTableProps = {
  quotations: SalesQuotation[];
  currentUserId: string;
  currentUserRole: string | null;
  clients: Array<{
    id: string;
    companyName: string;
    isActive: boolean;
  }>;
};

type SortBy = "createdAt" | "amount";
type SortDirection = "asc" | "desc";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusLabel(status: SalesQuotation["status"]): string {
  if (status === "draft") {
    return "Draft";
  }

  if (status === "pending") {
    return "Pending";
  }

  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Cancelled";
}

function sortQuotations(
  quotations: SalesQuotation[],
  sortBy: SortBy,
  direction: SortDirection,
): SalesQuotation[] {
  const sorted = [...quotations].sort((first, second) => {
    if (sortBy === "amount") {
      return first.amount - second.amount;
    }

    return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
  });

  if (direction === "desc") {
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

export function QuotationsTable({
  quotations,
  currentUserId,
  currentUserRole,
  clients,
}: QuotationsTableProps) {
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedQuotation, setSelectedQuotation] = useState<SalesQuotation | null>(null);

  const sortedQuotations = useMemo(
    () => sortQuotations(quotations, sortBy, sortDirection),
    [quotations, sortBy, sortDirection],
  );

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
          variant={sortBy === "createdAt" ? "default" : "outline"}
          size="sm"
          onClick={() => toggleSort("createdAt")}
        >
          Date {sortBy === "createdAt" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
        </Button>
        <Button
          type="button"
          variant={sortBy === "amount" ? "default" : "outline"}
          size="sm"
          onClick={() => toggleSort("amount")}
        >
          Amount {sortBy === "amount" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Client Name</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedQuotations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">No quotations found.</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted quotations will appear here after creation.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedQuotations.map((quotation) => (
                <tr
                  key={quotation.id}
                  className="cursor-pointer border-t hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`View quotation ${quotation.quotationNumber}`}
                  onClick={() => setSelectedQuotation(quotation)}
                  onKeyDown={(event) => onRowKeyDown(event, () => setSelectedQuotation(quotation))}
                >
                  <td className="px-3 py-2 font-mono text-xs">{quotation.quotationNumber}</td>
                  <td className="px-3 py-2">{quotation.clientName}</td>
                  <td className="px-3 py-2">{formatCurrency(quotation.amount)}</td>
                  <td className="px-3 py-2">{statusLabel(quotation.status)}</td>
                  <td className="px-3 py-2">{new Date(quotation.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <QuotationDetailsDialog
        open={selectedQuotation !== null}
        quotation={selectedQuotation}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        clients={clients}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedQuotation(null);
          }
        }}
      />
    </>
  );
}