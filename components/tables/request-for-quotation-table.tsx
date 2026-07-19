"use client";

import {
  DataCard,
  DataField,
  EmptyState,
  ResponsiveTable,
  StatusBadge,
} from "@/components/patterns";
import type { RequestForQuotation } from "@/lib/sales/quotations";
import { formatCurrency } from "@/lib/utils/number-format";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Fragment, useState } from "react";

type RequestForQuotationTableProps = {
  requests: RequestForQuotation[];
};

function badgeStatus(request: RequestForQuotation): string {
  if (request.status === "draft" && request.costingRejectionReason) {
    return "returned";
  }
  return request.status;
}

function ItemsBreakdown({ request }: { request: RequestForQuotation }) {
  return (
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
        {request.items.map((item) => (
          <tr key={item.id} className="border-t">
            <td className="py-1 pr-3">{item.description}</td>
            <td className="py-1 pr-3">{item.quantity}</td>
            <td className="py-1 pr-3">
              {item.unitCost === null ? (
                <span className="text-muted-foreground">Not costed yet</span>
              ) : (
                formatCurrency(item.unitCost)
              )}
            </td>
            <td className="py-1">{formatCurrency(item.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RequestForQuotationTable({ requests }: RequestForQuotationTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const emptyState = (
    <EmptyState
      icon={FileText}
      title="No requests for quotation yet."
      description="Raise one to send items to Engineering for costing."
    />
  );

  return (
    <ResponsiveTable
      table={
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Quotation #</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Items</th>
              <th className="px-3 py-2 font-medium">Cost So Far</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7}>{emptyState}</td>
              </tr>
            ) : (
              requests.map((request) => (
                <Fragment key={request.id}>
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-label={`Toggle items for ${request.quotationNumber}`}
                    onClick={() => toggle(request.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggle(request.id);
                      }
                    }}
                    className="cursor-pointer border-t transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <td className="px-3 py-2 text-muted-foreground">
                      {expanded.has(request.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-3 py-2">{request.quotationNumber}</td>
                    <td className="px-3 py-2">{request.clientName}</td>
                    <td className="px-3 py-2">{request.subject}</td>
                    <td className="px-3 py-2">{request.items.length}</td>
                    <td className="px-3 py-2">
                      {request.cost === null ? (
                        <span className="text-muted-foreground">Not costed yet</span>
                      ) : (
                        formatCurrency(request.cost)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={badgeStatus(request)} />
                    </td>
                  </tr>
                  {expanded.has(request.id) ? (
                    <tr className="border-t bg-muted/20">
                      <td />
                      <td colSpan={6} className="px-3 py-2">
                        <ItemsBreakdown request={request} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      }
      cards={
        requests.length === 0 ? (
          <div className="rounded-lg border">{emptyState}</div>
        ) : (
          requests.map((request) => (
            <DataCard
              key={request.id}
              onActivate={() => toggle(request.id)}
              ariaLabel={`Toggle items for ${request.quotationNumber}`}
              header={
                <>
                  <p className="truncate font-semibold">{request.quotationNumber}</p>
                  <StatusBadge status={badgeStatus(request)} />
                </>
              }
              footer={
                expanded.has(request.id) ? <ItemsBreakdown request={request} /> : null
              }
            >
              <DataField label="Client" value={request.clientName} />
              <DataField label="Subject" value={request.subject} />
              <DataField label="Items" value={request.items.length} />
              <DataField
                label="Cost So Far"
                value={
                  request.cost === null ? "Not costed yet" : formatCurrency(request.cost)
                }
              />
            </DataCard>
          ))
        )
      }
    />
  );
}
