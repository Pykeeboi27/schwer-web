"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuotationDetailsDialog } from "@/components/dialogs/quotation-details-dialog";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { FileText, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

type QuotationsTableProps = {
  quotations: SalesQuotation[];
  currentUserId: string;
  currentUserRole: string | null;
};

type SortBy = "createdAt" | "amount";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | SalesQuotation["status"];

const STATUS_LABELS: Record<SalesQuotation["status"], string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<SalesQuotation["status"], string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-gray-200 bg-gray-50 text-gray-500",
};

const ALL_STATUSES: SalesQuotation["status"][] = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function StatusBadge({ status }: { status: SalesQuotation["status"] }) {
  return (
    <Badge className={STATUS_CLASSES[status]} variant="outline">
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function sortQuotations(
  quotations: SalesQuotation[],
  sortBy: SortBy,
  direction: SortDirection,
): SalesQuotation[] {
  const sorted = [...quotations].sort((first, second) => {
    if (sortBy === "amount") return first.amount - second.amount;
    return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
  });
  if (direction === "desc") sorted.reverse();
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
}: QuotationsTableProps) {
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedQuotation, setSelectedQuotation] = useState<SalesQuotation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredAndSorted = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let filtered = quotations;

    if (query) {
      filtered = filtered.filter(
        (q) =>
          q.clientName.toLowerCase().includes(query) ||
          q.quotationNumber.toLowerCase().includes(query) ||
          q.subject.toLowerCase().includes(query),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }

    return sortQuotations(filtered, sortBy, sortDirection);
  }, [quotations, searchQuery, statusFilter, sortBy, sortDirection]);

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
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          {ALL_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">Sort:</span>
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
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">No quotations found.</p>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery || statusFilter !== "all"
                        ? "Try adjusting your search or filter."
                        : "Submitted quotations will appear here after creation."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((quotation) => (
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
                  <td className="px-3 py-2">
                    <StatusBadge status={quotation.status} />
                  </td>
                  <td className="px-3 py-2">
                    {new Date(quotation.createdAt).toLocaleDateString()}
                  </td>
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
        onOpenChange={(open) => {
          if (!open) setSelectedQuotation(null);
        }}
      />
    </>
  );
}
