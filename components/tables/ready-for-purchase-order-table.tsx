"use client";

import { QuotationDetailsDialog } from "@/components/dialogs/quotation-details-dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/patterns";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { Inbox, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

type ReadyForPurchaseOrderTableProps = {
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

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatLeadTime(days: number | null): string {
  if (days === null) return "—";
  return `${days} day${days === 1 ? "" : "s"}`;
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

export function ReadyForPurchaseOrderTable({
  quotations,
  currentUserId,
  currentUserRole,
}: ReadyForPurchaseOrderTableProps) {
  const [selectedQuotation, setSelectedQuotation] = useState<SalesQuotation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return quotations;
    return quotations.filter(
      (q) =>
        q.clientName.toLowerCase().includes(query) ||
        q.quotationNumber.toLowerCase().includes(query) ||
        q.subject.toLowerCase().includes(query) ||
        (q.clientPoNumber ?? "").toLowerCase().includes(query),
    );
  }, [quotations, searchQuery]);

  return (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, quotation #, subject, or client PO #…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Quotation</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Client PO #</th>
              <th className="px-3 py-2 font-medium">Cost</th>
              <th className="px-3 py-2 font-medium">Margin %</th>
              <th className="px-3 py-2 font-medium">Payment Terms</th>
              <th className="px-3 py-2 font-medium">Lead Time</th>
              <th className="px-3 py-2 font-medium">Client Confirmed At</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    icon={Inbox}
                    title={
                      searchQuery
                        ? "No quotations match your search."
                        : "No quotations awaiting purchase-order conversion yet."
                    }
                    description={
                      searchQuery
                        ? undefined
                        : "Approved quotations with a recorded client PO will appear here."
                    }
                  />
                </td>
              </tr>
            ) : (
              filtered.map((quotation) => (
                <tr
                  key={quotation.id}
                  className="cursor-pointer border-t hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open purchase-order details for quotation ${quotation.quotationNumber}`}
                  onClick={() => setSelectedQuotation(quotation)}
                  onKeyDown={(event) =>
                    onRowKeyDown(event, () => setSelectedQuotation(quotation))
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {quotation.quotationNumber}
                  </td>
                  <td className="px-3 py-2">{quotation.clientName}</td>
                  <td className="px-3 py-2">{quotation.subject || "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(quotation.amount)}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {quotation.clientPoNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {quotation.cost === null ? "-" : formatCurrency(quotation.cost)}
                  </td>
                  <td className="px-3 py-2">
                    {formatPercent(quotation.salesMarginPercent)}
                  </td>
                  <td className="px-3 py-2">{quotation.paymentTerms ?? "—"}</td>
                  <td className="px-3 py-2">{formatLeadTime(quotation.leadTimeDays)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(quotation.clientConfirmedAt)}
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
