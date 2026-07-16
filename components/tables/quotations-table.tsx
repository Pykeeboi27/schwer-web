"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataCard,
  DataField,
  EmptyState,
  ResponsiveTable,
  StatusBadge,
  statusLabel,
} from "@/components/patterns";
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

const ALL_STATUSES: SalesQuotation["status"][] = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "closed",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
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

  const emptyState = (
    <EmptyState
      icon={FileText}
      title="No quotations found."
      description={
        searchQuery || statusFilter !== "all"
          ? "Try adjusting your search or filter."
          : "Submitted quotations will appear here after creation."
      }
    />
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, quotation #, or subject…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-[150px]" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex overflow-hidden rounded-md border">
            <Button
              type="button"
              variant={sortBy === "createdAt" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-r"
              onClick={() => toggleSort("createdAt")}
            >
              Date {sortBy === "createdAt" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </Button>
            <Button
              type="button"
              variant={sortBy === "amount" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => toggleSort("amount")}
            >
              Amount {sortBy === "amount" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </Button>
          </div>
        </div>
      </div>

      <ResponsiveTable
        table={
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Client Name</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Authored By</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={6}>{emptyState}</td>
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
                    onKeyDown={(event) =>
                      onRowKeyDown(event, () => setSelectedQuotation(quotation))
                    }
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {quotation.quotationNumber}
                    </td>
                    <td className="px-3 py-2">{quotation.clientName}</td>
                    <td className="px-3 py-2">{formatCurrency(quotation.amount)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {quotation.salesPersonName ?? "Unassigned"}
                    </td>
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
        }
        cards={
          filteredAndSorted.length === 0 ? (
            <div className="rounded-lg border">{emptyState}</div>
          ) : (
            filteredAndSorted.map((quotation) => (
              <DataCard
                key={quotation.id}
                onActivate={() => setSelectedQuotation(quotation)}
                ariaLabel={`View quotation ${quotation.quotationNumber}`}
                header={
                  <>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{quotation.clientName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {quotation.quotationNumber}
                      </p>
                    </div>
                    <StatusBadge status={quotation.status} />
                  </>
                }
              >
                <DataField label="Amount" value={formatCurrency(quotation.amount)} />
                <DataField
                  label="Authored By"
                  value={quotation.salesPersonName ?? "Unassigned"}
                />
                <DataField
                  label="Date"
                  value={new Date(quotation.createdAt).toLocaleDateString()}
                />
              </DataCard>
            ))
          )
        }
      />

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
