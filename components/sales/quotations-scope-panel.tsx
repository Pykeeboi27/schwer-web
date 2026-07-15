"use client";

import { QuotationsTable } from "@/components/tables/quotations-table";
import { BeamTick, Panel } from "@/components/patterns";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Scope = "mine" | "company";

type QuotationsScopePanelProps = {
  myQuotations: SalesQuotation[];
  companyQuotations: SalesQuotation[];
  currentUserId: string;
  currentUserRole: string | null;
};

const SCOPE_COPY: Record<Scope, { label: string; description: string }> = {
  mine: {
    label: "Mine",
    description:
      "Quotations assigned to you. Fully editable while in draft or re-opened for a PO.",
  },
  company: {
    label: "Company",
    description:
      "Quotations assigned to other sales people. Read-only unless you're an approver.",
  },
};

/**
 * Toggles the quotations table between "assigned to me" and "everyone else's",
 * replacing two always-expanded panels with one — the two lists rarely need to
 * be compared side by side, and this halves the vertical space on this page.
 */
export function QuotationsScopePanel({
  myQuotations,
  companyQuotations,
  currentUserId,
  currentUserRole,
}: QuotationsScopePanelProps) {
  const [scope, setScope] = useState<Scope>("mine");
  const quotations = scope === "mine" ? myQuotations : companyQuotations;

  return (
    <Panel
      title={<BeamTick>Quotations</BeamTick>}
      description={SCOPE_COPY[scope].description}
      actions={
        <div
          className="flex items-center gap-0 self-start overflow-hidden rounded-lg border bg-card"
          role="tablist"
          aria-label="Quotation scope"
        >
          {(["mine", "company"] as const).map((value, idx) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                idx === 0 && "border-r",
                scope === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {SCOPE_COPY[value].label}
              <span className="ml-1.5 tabular-nums opacity-80">
                {value === "mine" ? myQuotations.length : companyQuotations.length}
              </span>
            </button>
          ))}
        </div>
      }
    >
      <QuotationsTable
        quotations={quotations}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    </Panel>
  );
}
