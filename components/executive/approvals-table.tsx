"use client";

import { ApprovalDetailsDialog } from "@/components/executive/approval-details-dialog";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
import type { PendingApprovalItem } from "@/lib/sales/quotations";
import { formatCurrency } from "@/lib/utils/number-format";
import { useState } from "react";

type ExecutiveApprovalsTableProps = {
  items: PendingApprovalItem[];
  currentUserRole: string | null;
};

export function ExecutiveApprovalsTable({
  items,
  currentUserRole,
}: ExecutiveApprovalsTableProps) {
  const [selectedItem, setSelectedItem] = useState<PendingApprovalItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-md border">
        <EmptyState title="No pending executive approvals at the moment." />
      </div>
    );
  }

  return (
    <>
      <ResponsiveTable
        table={
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Quotation</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Authored By</th>
                <th className="px-3 py-2 font-medium">Required Role</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.approvalId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedItem(item);
                    }
                  }}
                  className="cursor-pointer border-t align-top transition-colors hover:bg-muted/40"
                >
                  <td className="px-3 py-2 font-mono text-xs">{item.quotationNumber}</td>
                  <td className="px-3 py-2">{item.subject || "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.preparedByName ?? "-"}
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {item.approverRole.replaceAll("_", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        cards={items.map((item) => (
          <DataCard
            key={item.approvalId}
            onActivate={() => setSelectedItem(item)}
            ariaLabel={`View ${item.quotationNumber}`}
            header={
              <>
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.quotationNumber}
                  </p>
                  <p className="truncate font-semibold">{item.subject || "-"}</p>
                </div>
                <span className="shrink-0 font-semibold">
                  {formatCurrency(item.amount)}
                </span>
              </>
            }
          >
            <DataField label="Authored By" value={item.preparedByName ?? "-"} />
            <DataField
              label="Required Role"
              value={
                <span className="capitalize">
                  {item.approverRole.replaceAll("_", " ")}
                </span>
              }
            />
          </DataCard>
        ))}
      />

      <ApprovalDetailsDialog
        item={selectedItem}
        currentUserRole={currentUserRole}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />
    </>
  );
}
