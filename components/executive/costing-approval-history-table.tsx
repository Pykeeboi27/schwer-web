"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataCard,
  DataField,
  EmptyState,
  ResponsiveTable,
  StatusBadge,
} from "@/components/patterns";
import type { CostingApprovalHistoryItem } from "@/lib/executive/costing-approvals";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type CostingApprovalHistoryTableProps = {
  items: CostingApprovalHistoryItem[];
};

type DecisionFilter = "all" | CostingApprovalHistoryItem["decision"];

const DECISION_FILTER_LABELS: Record<DecisionFilter, string> = {
  all: "All",
  approved: "Approved",
  rejected: "Rejected",
};

const ALL_DECISION_FILTERS: DecisionFilter[] = ["all", "approved", "rejected"];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CostingApprovalHistoryTable({ items }: CostingApprovalHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (
        query &&
        !item.clientName.toLowerCase().includes(query) &&
        !item.quotationNumber.toLowerCase().includes(query) &&
        !item.subject.toLowerCase().includes(query)
      ) {
        return false;
      }
      return decisionFilter === "all" || item.decision === decisionFilter;
    });
  }, [items, searchQuery, decisionFilter]);

  if (items.length === 0) {
    return <EmptyState title="No past costing approval decisions yet." />;
  }

  const emptyState = (
    <EmptyState
      title="No costing decisions match your search."
      description={
        searchQuery || decisionFilter !== "all"
          ? "Try adjusting your search or filter."
          : undefined
      }
    />
  );

  return (
    <div>
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
          {ALL_DECISION_FILTERS.map((filter) => (
            <Button
              key={filter}
              type="button"
              variant={decisionFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => setDecisionFilter(filter)}
            >
              {DECISION_FILTER_LABELS[filter]}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border">{emptyState}</div>
      ) : (
        <ResponsiveTable
          table={
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Quotation</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Cost</th>
                  <th className="px-3 py-2 font-medium">Prepared By</th>
                  <th className="px-3 py-2 font-medium">Decision</th>
                  <th className="px-3 py-2 font-medium">Rejection Reason</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.quotationId} className="border-t align-top">
                    <td className="px-3 py-2 font-mono text-xs">
                      {item.quotationNumber}
                    </td>
                    <td className="px-3 py-2">{item.clientName}</td>
                    <td className="px-3 py-2">{item.subject || "-"}</td>
                    <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
                    <td className="px-3 py-2">
                      {item.cost === null ? "-" : formatCurrency(item.cost)}
                    </td>
                    <td className="px-3 py-2">{item.preparedByName}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={item.decision} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {item.rejectionReason ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(item.resolvedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          cards={filtered.map((item) => (
            <DataCard
              key={item.quotationId}
              header={
                <>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.clientName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.quotationNumber}
                    </p>
                  </div>
                  <StatusBadge status={item.decision} />
                </>
              }
            >
              <DataField label="Subject" value={item.subject || "-"} />
              <DataField label="Amount" value={formatCurrency(item.amount)} />
              <DataField
                label="Cost"
                value={item.cost === null ? "-" : formatCurrency(item.cost)}
              />
              <DataField label="Prepared By" value={item.preparedByName} />
              {item.rejectionReason ? (
                <DataField
                  label="Rejection Reason"
                  value={
                    <span className="text-muted-foreground">{item.rejectionReason}</span>
                  }
                />
              ) : null}
              <DataField label="Date" value={formatDate(item.resolvedAt)} />
            </DataCard>
          ))}
        />
      )}
    </div>
  );
}
