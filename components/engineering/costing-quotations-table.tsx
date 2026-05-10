"use client";

import {
  deleteCostingQuotationAction,
  submitCostingForApprovalAction,
} from "@/app/protected/engineering/quotations/actions";
import { EditCostingQuotationDialog } from "@/components/dialogs/edit-costing-quotation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { useToast } from "@/lib/utils/toast-notification";
import { ExternalLink, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type CostingQuotationsTableProps = {
  quotations: CostingQuotation[];
  currentUserId: string;
  clients: ClientOption[];
};

type StatusFilter = "all" | CostingQuotation["status"] | "returned";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  draft: "Draft",
  returned: "Returned",
  pending: "Pending Approval",
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getDisplayStatus(q: CostingQuotation): { label: string; className: string } {
  if (q.status === "draft" && q.costingRejectionReason) {
    return {
      label: "Returned for Edits",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }
  const map: Record<CostingQuotation["status"], { label: string; className: string }> = {
    draft: { label: "Draft", className: "border-slate-200 bg-slate-50 text-slate-600" },
    pending: {
      label: "Pending Approval",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    approved: { label: "Approved", className: "border-green-200 bg-green-50 text-green-700" },
    rejected: { label: "Rejected", className: "border-red-200 bg-red-50 text-red-700" },
    cancelled: { label: "Cancelled", className: "border-gray-200 bg-gray-50 text-gray-500" },
  };
  return map[q.status];
}

function matchesStatusFilter(q: CostingQuotation, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "returned") return q.status === "draft" && !!q.costingRejectionReason;
  if (filter === "draft") return q.status === "draft" && !q.costingRejectionReason;
  return q.status === filter;
}

export function CostingQuotationsTable({
  quotations,
  currentUserId,
  clients,
}: CostingQuotationsTableProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [editing, setEditing] = useState<CostingQuotation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const handleSubmit = async (q: CostingQuotation) => {
    setBusyId(q.id);
    const response = await submitCostingForApprovalAction(q.id);
    if (!response.success) {
      error(response.error ?? "Failed to submit for costing approval.");
      setBusyId(null);
      return;
    }
    success(`Submitted ${q.quotationNumber} for costing approval.`);
    setBusyId(null);
    router.refresh();
  };

  const handleDelete = async (q: CostingQuotation) => {
    setBusyId(q.id);
    const response = await deleteCostingQuotationAction(q.id);
    if (!response.success) {
      error(response.error ?? "Failed to delete quotation.");
      setBusyId(null);
      return;
    }
    success(`Deleted ${q.quotationNumber}.`);
    setBusyId(null);
    router.refresh();
  };

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

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Cost</th>
              <th className="px-3 py-2 font-medium">Drive</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">No costing quotations found.</p>
                    {(searchQuery || statusFilter !== "all") && (
                      <p className="text-xs text-muted-foreground">
                        Try adjusting your search or filter.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((q) => {
                const isMine = q.preparedBy === currentUserId;
                const isEditable = isMine && q.status === "draft";
                const isPending = q.status === "pending";
                const isBusy = busyId === q.id;
                const display = getDisplayStatus(q);

                return (
                  <tr key={q.id} className="border-t align-top">
                    <td className="px-3 py-2 font-mono text-xs">{q.quotationNumber}</td>
                    <td className="px-3 py-2">{q.clientName}</td>
                    <td className="px-3 py-2">{q.subject}</td>
                    <td className="px-3 py-2">{formatCurrency(q.amount)}</td>
                    <td className="px-3 py-2">
                      {q.cost === null ? "-" : formatCurrency(q.cost)}
                    </td>
                    <td className="px-3 py-2">
                      {q.googleDriveLink ? (
                        <a
                          href={q.googleDriveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          aria-label="Open Google Drive link"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <Badge className={display.className} variant="outline">
                          {display.label}
                        </Badge>
                        {q.costingRejectionReason ? (
                          <span className="text-xs text-destructive">
                            {q.costingRejectionReason}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {isPending ? (
                        <span className="text-xs text-muted-foreground">Awaiting executive</span>
                      ) : isEditable ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(q)}
                            disabled={isBusy}
                          >
                            Edit
                          </Button>
                          <Button size="sm" onClick={() => handleSubmit(q)} disabled={isBusy}>
                            {isBusy ? "Saving..." : "Submit for Approval"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(q)}
                            disabled={isBusy}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">View only</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EditCostingQuotationDialog
        open={editing !== null}
        quotation={editing}
        clients={clients}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}
