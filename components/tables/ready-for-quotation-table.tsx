"use client";

import { QuotationDetailsDialog } from "@/components/dialogs/quotation-details-dialog";
import { Input } from "@/components/ui/input";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { Inbox, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

type ReadyForQuotationTableProps = {
  quotations: SalesQuotation[];
  currentUserId: string;
  currentUserRole: string | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

export function ReadyForQuotationTable({
  quotations,
  currentUserId,
  currentUserRole,
}: ReadyForQuotationTableProps) {
  const [selectedQuotation, setSelectedQuotation] = useState<SalesQuotation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return quotations;
    return quotations.filter(
      (q) =>
        q.clientName.toLowerCase().includes(query) ||
        q.quotationNumber.toLowerCase().includes(query) ||
        q.subject.toLowerCase().includes(query),
    );
  }, [quotations, searchQuery]);

  const emptyState = (
    <EmptyState
      icon={Inbox}
      title={
        searchQuery
          ? "No quotations match your search."
          : "No quotations awaiting sales details yet."
      }
      description={
        searchQuery
          ? undefined
          : "Costing quotations approved by the executive will appear here."
      }
    />
  );

  return (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, quotation #, or subject…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <ResponsiveTable
        table={
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="w-[22%] px-3 py-2 font-medium">Client</th>
                <th className="w-[23%] px-3 py-2 font-medium">Subject</th>
                <th className="w-[14%] px-3 py-2 font-medium">Amount</th>
                <th className="w-[13%] px-3 py-2 font-medium">Cost</th>
                <th className="w-[15%] px-3 py-2 font-medium">Authored By</th>
                <th className="w-[13%] px-3 py-2 font-medium">Approved At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>{emptyState}</td>
                </tr>
              ) : (
                filtered.map((quotation) => (
                  <tr
                    key={quotation.id}
                    className="cursor-pointer border-t hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open sales details for quotation ${quotation.quotationNumber}`}
                    onClick={() => setSelectedQuotation(quotation)}
                    onKeyDown={(event) =>
                      onRowKeyDown(event, () => setSelectedQuotation(quotation))
                    }
                  >
                    <td className="truncate px-3 py-2" title={quotation.clientName}>
                      {quotation.clientName}
                    </td>
                    <td
                      className="truncate px-3 py-2"
                      title={quotation.subject || undefined}
                    >
                      {quotation.subject || "-"}
                    </td>
                    <td className="truncate px-3 py-2">
                      {formatCurrency(quotation.amount)}
                    </td>
                    <td className="truncate px-3 py-2">
                      {quotation.cost === null ? "-" : formatCurrency(quotation.cost)}
                    </td>
                    <td className="truncate px-3 py-2 text-muted-foreground">
                      {quotation.salesPersonName ?? "Unassigned"}
                    </td>
                    <td className="truncate px-3 py-2 text-muted-foreground">
                      {formatDate(quotation.costingApprovedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        }
        cards={
          filtered.length === 0 ? (
            <div className="rounded-lg border">{emptyState}</div>
          ) : (
            filtered.map((quotation) => (
              <DataCard
                key={quotation.id}
                onActivate={() => setSelectedQuotation(quotation)}
                ariaLabel={`Open sales details for quotation ${quotation.quotationNumber}`}
                header={
                  <>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{quotation.clientName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {quotation.quotationNumber}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">
                      {formatCurrency(quotation.amount)}
                    </span>
                  </>
                }
              >
                <DataField label="Subject" value={quotation.subject || "-"} />
                <DataField
                  label="Cost"
                  value={quotation.cost === null ? "-" : formatCurrency(quotation.cost)}
                />
                <DataField
                  label="Authored By"
                  value={quotation.salesPersonName ?? "Unassigned"}
                />
                <DataField
                  label="Approved At"
                  value={formatDate(quotation.costingApprovedAt)}
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
