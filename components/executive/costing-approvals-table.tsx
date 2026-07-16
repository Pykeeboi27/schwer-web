"use client";

import { CostingApprovalDetailsDialog } from "@/components/executive/costing-approval-details-dialog";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
import type { CostingApprovalItem } from "@/lib/executive/costing-approvals";
import { formatCurrency } from "@/lib/utils/number-format";
import { useState } from "react";

type ExecutiveCostingApprovalsTableProps = {
  items: CostingApprovalItem[];
};

export function ExecutiveCostingApprovalsTable({
  items,
}: ExecutiveCostingApprovalsTableProps) {
  const [selectedItem, setSelectedItem] = useState<CostingApprovalItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-md border">
        <EmptyState title="No quotations awaiting costing approval." />
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
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Cost</th>
                <th className="px-3 py-2 font-medium">Prepared By</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.quotationId}
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
                  <td className="px-3 py-2">{item.clientName}</td>
                  <td className="px-3 py-2">{formatCurrency(item.cost)}</td>
                  <td className="px-3 py-2">{item.preparedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        cards={items.map((item) => (
          <DataCard
            key={item.quotationId}
            onActivate={() => setSelectedItem(item)}
            ariaLabel={`View ${item.quotationNumber}`}
            header={
              <>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.clientName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.quotationNumber}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">
                  {formatCurrency(item.cost)}
                </span>
              </>
            }
          >
            <DataField label="Prepared By" value={item.preparedByName} />
          </DataCard>
        ))}
      />

      <CostingApprovalDetailsDialog
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />
    </>
  );
}
