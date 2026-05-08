"use client";

import {
  deleteCostingQuotationAction,
  submitCostingForApprovalAction,
} from "@/app/protected/engineering/quotations/actions";
import { EditCostingQuotationDialog } from "@/components/dialogs/edit-costing-quotation-dialog";
import { Button } from "@/components/ui/button";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { useToast } from "@/lib/utils/toast-notification";
import { ExternalLink, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusBadge(quotation: CostingQuotation): string {
  if (quotation.status === "draft" && quotation.costingRejectionReason) {
    return "Returned for Edits";
  }
  if (quotation.status === "draft") return "Draft";
  if (quotation.status === "pending") return "Pending Costing Approval";
  if (quotation.status === "approved") return "Approved";
  if (quotation.status === "rejected") return "Rejected";
  return "Cancelled";
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
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                    <p className="font-medium text-foreground">No costing quotations yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              quotations.map((q) => {
                const isMine = q.preparedBy === currentUserId;
                const isEditable = isMine && q.status === "draft";
                const isPending = q.status === "pending";
                const isBusy = busyId === q.id;

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
                        <span>{statusBadge(q)}</span>
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
