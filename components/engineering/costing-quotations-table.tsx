"use client";

import { CostingQuotationDetailsDialog } from "@/components/dialogs/costing-quotation-details-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DataCard,
  DataField,
  EmptyState,
  ResponsiveTable,
  StatusBadge,
} from "@/components/patterns";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { formatCurrency } from "@/lib/utils/number-format";
import { FileText, Search } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type SalesPersonOption = {
  id: string;
  name: string;
};

type CostingQuotationsTableProps = {
  quotations: CostingQuotation[];
  clients: ClientOption[];
  salesPeople: SalesPersonOption[];
};

type StatusFilter = "all" | CostingQuotation["status"] | "returned";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  draft: "Draft",
  returned: "Returned",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ALL_FILTER_OPTIONS: StatusFilter[] = [
  "all",
  "draft",
  "returned",
  "pending",
  "approved",
  "rejected",
];

/** Resolve a costing quotation to a shared StatusBadge key. */
function costingBadgeStatus(q: CostingQuotation): string {
  if (q.status === "draft" && q.costingRejectionReason) {
    return "returned";
  }
  return q.status;
}

function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, onActivate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}

function matchesStatusFilter(q: CostingQuotation, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "returned") return q.status === "draft" && !!q.costingRejectionReason;
  if (filter === "draft") return q.status === "draft" && !q.costingRejectionReason;
  return q.status === filter;
}

export function CostingQuotationsTable({
  quotations,
  clients,
  salesPeople,
}: CostingQuotationsTableProps) {
  const [viewing, setViewing] = useState<CostingQuotation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return quotations.filter((q) => {
      if (
        query &&
        !q.clientName.toLowerCase().includes(query) &&
        !q.quotationNumber.toLowerCase().includes(query) &&
        !q.subject.toLowerCase().includes(query)
      ) {
        return false;
      }
      return matchesStatusFilter(q, statusFilter);
    });
  }, [quotations, searchQuery, statusFilter]);

  const emptyState = (
    <EmptyState
      icon={FileText}
      title="No costing quotations found."
      description={
        searchQuery || statusFilter !== "all"
          ? "Try adjusting your search or filter."
          : undefined
      }
    />
  );

  return (
    <>
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
          {ALL_FILTER_OPTIONS.map((f) => (
            <Button
              key={f}
              type="button"
              variant={statusFilter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(f)}
            >
              {STATUS_FILTER_LABELS[f]}
            </Button>
          ))}
        </div>
      </div>

      <ResponsiveTable
        table={
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Total Cost</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>{emptyState}</td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr
                    key={q.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${q.quotationNumber}`}
                    onClick={() => setViewing(q)}
                    onKeyDown={(event) => onRowKeyDown(event, () => setViewing(q))}
                    className="cursor-pointer border-t align-top transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <td className="px-3 py-2">{q.clientName}</td>
                    <td className="px-3 py-2">{q.subject}</td>
                    <td className="px-3 py-2">{formatCurrency(q.cost)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={costingBadgeStatus(q)} />
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
            filtered.map((q) => (
              <DataCard
                key={q.id}
                onActivate={() => setViewing(q)}
                ariaLabel={`View ${q.quotationNumber}`}
                header={
                  <>
                    <p className="truncate font-semibold">{q.clientName}</p>
                    <StatusBadge status={costingBadgeStatus(q)} />
                  </>
                }
              >
                <DataField label="Subject" value={q.subject} />
                <DataField label="Total Cost" value={formatCurrency(q.cost)} />
              </DataCard>
            ))
          )
        }
      />

      <CostingQuotationDetailsDialog
        open={viewing !== null}
        quotation={viewing}
        clients={clients}
        salesPeople={salesPeople}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </>
  );
}
