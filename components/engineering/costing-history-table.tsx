"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
import type { CostingApprovedHistoryItem } from "@/lib/engineering/costing-quotations";
import { formatCurrency } from "@/lib/utils/number-format";
import { ExternalLink } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";

type CostingHistoryTableProps = {
  items: CostingApprovedHistoryItem[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function driveLink(link: string | null) {
  return link ? (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
      aria-label="Open Google Drive link"
    >
      <ExternalLink className="h-3.5 w-3.5" /> Open
    </a>
  ) : (
    <span className="text-muted-foreground">-</span>
  );
}

function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, onActivate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}

export function CostingHistoryTable({ items }: CostingHistoryTableProps) {
  const [viewing, setViewing] = useState<CostingApprovedHistoryItem | null>(null);

  if (items.length === 0) {
    return <EmptyState title="No approved costing quotations yet." />;
  }

  return (
    <>
      <ResponsiveTable
        table={
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Direct Cost</th>
                <th className="px-3 py-2 font-medium">Sales Person</th>
                <th className="px-3 py-2 font-medium">Approved</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.quotationId}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${item.quotationNumber}`}
                  onClick={() => setViewing(item)}
                  onKeyDown={(event) => onRowKeyDown(event, () => setViewing(item))}
                  className="cursor-pointer border-t transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <td className="px-3 py-2">{item.clientName}</td>
                  <td className="px-3 py-2">{item.subject || "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(item.cost)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.salesPersonName ?? "Unassigned"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(item.approvedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        cards={items.map((item) => (
          <DataCard
            key={item.quotationId}
            onActivate={() => setViewing(item)}
            ariaLabel={`View ${item.quotationNumber}`}
            header={<p className="truncate font-semibold">{item.clientName}</p>}
          >
            <DataField label="Subject" value={item.subject || "-"} />
            <DataField label="Direct Cost" value={formatCurrency(item.cost)} />
            <DataField
              label="Sales Person"
              value={item.salesPersonName ?? "Unassigned"}
            />
            <DataField label="Approved" value={formatDate(item.approvedAt)} />
          </DataCard>
        ))}
      />

      <Dialog
        open={viewing !== null}
        onOpenChange={(next) => {
          if (!next) setViewing(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">
                  {viewing.quotationNumber}
                </DialogTitle>
              </DialogHeader>
              <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Client</dt>
                <dd className="font-medium">{viewing.clientName}</dd>

                <dt className="text-muted-foreground">Subject</dt>
                <dd className="font-medium">{viewing.subject || "-"}</dd>

                <dt className="text-muted-foreground">Sales Person</dt>
                <dd className="font-medium">
                  {viewing.salesPersonName ?? (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </dd>

                <dt className="text-muted-foreground">Google Drive</dt>
                <dd className="font-medium">{driveLink(viewing.googleDriveLink)}</dd>

                <dt className="text-muted-foreground">Notes</dt>
                <dd className="font-medium">
                  {viewing.notes ?? <span className="text-muted-foreground">-</span>}
                </dd>

                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{formatDate(viewing.createdAt)}</dd>

                <dt className="text-muted-foreground">Approved At</dt>
                <dd className="font-medium">{formatDate(viewing.approvedAt)}</dd>
              </dl>

              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Line Items
                </p>
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Item</th>
                      <th className="py-1 pr-3 font-medium">Qty</th>
                      <th className="py-1 pr-3 font-medium">Unit Cost</th>
                      <th className="py-1 font-medium">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-1 pr-3">{item.description}</td>
                        <td className="py-1 pr-3">{item.quantity}</td>
                        <td className="py-1 pr-3">
                          {item.unitCost === null ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            formatCurrency(item.unitCost)
                          )}
                        </td>
                        <td className="py-1">{formatCurrency(item.lineTotal)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-semibold">
                      <td className="py-1 pr-3" colSpan={3}>
                        Total Cost
                      </td>
                      <td className="py-1">{formatCurrency(viewing.cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
