"use client";

import {
  approveCostingQuotationAction,
  deleteCostingQuotationAction,
  rejectCostingQuotationAction,
} from "@/app/protected/executive/costing-approvals/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/patterns";
import type { CostingApprovalItem } from "@/lib/executive/costing-approvals";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CostingApprovalDetailsDialogProps = {
  item: CostingApprovalItem | null;
  onOpenChange: (open: boolean) => void;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CostingApprovalDetailsDialog({
  item,
  onOpenChange,
}: CostingApprovalDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!item) {
    return null;
  }

  const handleApprove = async () => {
    setIsBusy(true);
    const response = await approveCostingQuotationAction(item.quotationId);
    if (!response.success) {
      error(response.error ?? "Failed to approve costing quotation.");
      setIsBusy(false);
      return;
    }
    success(`Approved costing for ${item.quotationNumber}.`);
    setIsBusy(false);
    onOpenChange(false);
    router.refresh();
  };

  const handleReject = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      error("Please provide a rejection reason.");
      return;
    }
    setIsBusy(true);
    const response = await rejectCostingQuotationAction(item.quotationId, trimmedReason);
    if (!response.success) {
      error(response.error ?? "Failed to reject costing quotation.");
      setIsBusy(false);
      return;
    }
    success(`Rejected ${item.quotationNumber}; sent back to engineering.`);
    setIsBusy(false);
    onOpenChange(false);
    router.refresh();
  };

  const handleDelete = async () => {
    setIsBusy(true);
    const response = await deleteCostingQuotationAction(item.quotationId);
    if (!response.success) {
      error(response.error ?? "Failed to delete costing quotation.");
      setIsBusy(false);
      return;
    }
    success(`Deleted ${item.quotationNumber}.`);
    setIsBusy(false);
    setConfirmDeleteOpen(false);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <>
      <Dialog
        open={Boolean(item)}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">{item.quotationNumber}</DialogTitle>
          </DialogHeader>

          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd className="font-medium">{item.clientName}</dd>

            <dt className="text-muted-foreground">Subject</dt>
            <dd className="font-medium">{item.subject || "-"}</dd>

            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-medium">{formatCurrency(item.amount)}</dd>

            <dt className="text-muted-foreground">Google Drive</dt>
            <dd className="font-medium">
              {item.googleDriveLink ? (
                <a
                  href={item.googleDriveLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </dd>

            <dt className="text-muted-foreground">Prepared By</dt>
            <dd className="font-medium">{item.preparedByName}</dd>

            <dt className="text-muted-foreground">Notes</dt>
            <dd className="font-medium">{item.notes ?? "-"}</dd>

            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatDate(item.createdAt)}</dd>
          </dl>

          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">Line Items</p>
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
                {item.items.map((lineItem) => (
                  <tr key={lineItem.id} className="border-t">
                    <td className="py-1 pr-3">{lineItem.description}</td>
                    <td className="py-1 pr-3">{lineItem.quantity}</td>
                    <td className="py-1 pr-3">
                      {lineItem.unitCost === null ? (
                        <span className="text-muted-foreground">Not costed yet</span>
                      ) : (
                        formatCurrency(lineItem.unitCost)
                      )}
                    </td>
                    <td className="py-1">{formatCurrency(lineItem.lineTotal)}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="py-1 pr-3" colSpan={3}>
                    Total Cost
                  </td>
                  <td className="py-1">{formatCurrency(item.cost)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2 pt-2">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason required for reject"
              aria-label={`Rejection reason for ${item.quotationNumber}`}
              disabled={isBusy}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isBusy}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReject}
                disabled={isBusy}
              >
                Reject
              </Button>
              <Button type="button" onClick={handleApprove} disabled={isBusy}>
                {isBusy ? "Saving..." : "Approve"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this costing?"
        description={`Are you sure you want to delete the costing submission ${item.quotationNumber}? This cannot be undone.`}
        isBusy={isBusy}
        onConfirm={handleDelete}
      />
    </>
  );
}
