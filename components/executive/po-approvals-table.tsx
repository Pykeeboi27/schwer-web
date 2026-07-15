"use client";

import { PoApprovalDetailsDialog } from "@/components/executive/po-approval-details-dialog";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
import type { PendingPoApprovalItem } from "@/lib/sales/purchase-orders";
import { formatCurrency } from "@/lib/utils/number-format";
import { useState } from "react";

type ExecutivePoApprovalsTableProps = {
  items: PendingPoApprovalItem[];
  currentUserRole: string | null;
};

export function ExecutivePoApprovalsTable({
  items,
  currentUserRole,
}: ExecutivePoApprovalsTableProps) {
  const [selectedItem, setSelectedItem] = useState<PendingPoApprovalItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-md border">
        <EmptyState title="No pending purchase order approvals at the moment." />
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
                <th className="px-3 py-2 font-medium">Purchase Order</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Amount</th>
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
                  <td className="px-3 py-2 font-mono text-xs">{item.poNumber}</td>
                  <td className="px-3 py-2">{item.subject || "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
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
            ariaLabel={`View ${item.poNumber}`}
            header={
              <>
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.poNumber}
                  </p>
                  <p className="truncate font-semibold">{item.subject || "-"}</p>
                </div>
                <span className="shrink-0 font-semibold">
                  {formatCurrency(item.amount)}
                </span>
              </>
            }
          >
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

      <PoApprovalDetailsDialog
        item={selectedItem}
        currentUserRole={currentUserRole}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />
    </>
  );
}
