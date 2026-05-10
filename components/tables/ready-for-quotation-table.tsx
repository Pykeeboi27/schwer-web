"use client";

import { QuotationDetailsDialog } from "@/components/dialogs/quotation-details-dialog";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { Inbox } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

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
  if (!iso) {
    return "-";
  }

  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function formatLeadTime(days: number | null): string {
  if (days === null) {
    return "—";
  }

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

export function ReadyForQuotationTable({
  quotations,
  currentUserId,
  currentUserRole,
}: ReadyForQuotationTableProps) {
  const [selectedQuotation, setSelectedQuotation] = useState<SalesQuotation | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Quotation</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Cost</th>
              <th className="px-3 py-2 font-medium">Margin %</th>
              <th className="px-3 py-2 font-medium">Payment Terms</th>
              <th className="px-3 py-2 font-medium">Lead Time</th>
              <th className="px-3 py-2 font-medium">Approved At</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">
                      No quotations awaiting sales details yet.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Costing quotations approved by the executive will appear here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              quotations.map((quotation) => (
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
                  <td className="px-3 py-2 font-mono text-xs">{quotation.quotationNumber}</td>
                  <td className="px-3 py-2">{quotation.clientName}</td>
                  <td className="px-3 py-2">{quotation.subject || "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(quotation.amount)}</td>
                  <td className="px-3 py-2">
                    {quotation.cost === null ? "-" : formatCurrency(quotation.cost)}
                  </td>
                  <td className="px-3 py-2">{formatPercent(quotation.salesMarginPercent)}</td>
                  <td className="px-3 py-2">{quotation.paymentTerms ?? "—"}</td>
                  <td className="px-3 py-2">{formatLeadTime(quotation.leadTimeDays)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(quotation.costingApprovedAt)}
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
          if (!open) {
            setSelectedQuotation(null);
          }
        }}
      />
    </>
  );
}
