"use client";

import { CostingQuotationDetailsDialog } from "@/components/dialogs/costing-quotation-details-dialog";
import { EmptyState, StatusBadge } from "@/components/patterns";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { formatCurrency } from "@/lib/utils/number-format";
import { FileText } from "lucide-react";
import { useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type SalesPersonOption = {
  id: string;
  name: string;
};

type RecentCostingsPanelProps = {
  quotations: CostingQuotation[];
  currentUserId: string;
  clients: ClientOption[];
  salesPeople: SalesPersonOption[];
};

/** Resolve a costing quotation to a shared StatusBadge key. */
function costingBadgeStatus(q: CostingQuotation): string {
  if (q.status === "draft" && q.costingRejectionReason) {
    return "returned";
  }
  return q.status;
}

const RECENT_LIMIT = 5;

export function RecentCostingsPanel({
  quotations,
  currentUserId,
  clients,
  salesPeople,
}: RecentCostingsPanelProps) {
  const [viewing, setViewing] = useState<CostingQuotation | null>(null);
  const recent = quotations.slice(0, RECENT_LIMIT);

  if (recent.length === 0) {
    return <EmptyState icon={FileText} title="No costing quotations yet." />;
  }

  return (
    <>
      <ul className="divide-y">
        {recent.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => setViewing(q)}
              className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{q.clientName}</p>
                <p className="truncate text-xs text-muted-foreground">{q.subject}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium">{formatCurrency(q.cost)}</span>
                <StatusBadge status={costingBadgeStatus(q)} />
              </div>
            </button>
          </li>
        ))}
      </ul>

      <CostingQuotationDetailsDialog
        open={viewing !== null}
        quotation={viewing}
        currentUserId={currentUserId}
        clients={clients}
        salesPeople={salesPeople}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </>
  );
}
