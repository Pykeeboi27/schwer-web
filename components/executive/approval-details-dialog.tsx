"use client";

import {
  approveQuotationAction,
  rejectQuotationAction,
} from "@/app/protected/sales/quotations/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import type { PendingApprovalItem } from "@/lib/sales/quotations";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApprovalDetailsDialogProps = {
  item: PendingApprovalItem | null;
  currentUserRole: string | null;
  onOpenChange: (open: boolean) => void;
};

function formatDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ApprovalDetailsDialog({
  item,
  currentUserRole,
  onOpenChange,
}: ApprovalDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [reason, setReason] = useState("");

  const normalizedRole = String(currentUserRole ?? "")
    .trim()
    .toLowerCase();
  const canApprove = normalizedRole === "owner" || normalizedRole === "executive";

  if (!item) {
    return null;
  }

  const handleApprove = async () => {
    if (!canApprove) {
      error("Only owner or executive roles can approve high-value quotations.");
      return;
    }

    setIsBusy(true);
    const response = await approveQuotationAction(item.quotationId, normalizedRole);

    if (!response.success) {
      error(response.error ?? "Failed to approve quotation.");
      setIsBusy(false);
      return;
    }

    success(`Approved ${item.quotationNumber}.`);
    setIsBusy(false);
    onOpenChange(false);
    router.refresh();
  };

  const handleReject = async () => {
    if (!canApprove) {
      error("Only owner or executive roles can reject high-value quotations.");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      error("Please provide a rejection reason.");
      return;
    }

    setIsBusy(true);
    const response = await rejectQuotationAction(
      item.quotationId,
      trimmedReason,
      normalizedRole,
    );

    if (!response.success) {
      error(response.error ?? "Failed to reject quotation.");
      setIsBusy(false);
      return;
    }

    success(`Rejected ${item.quotationNumber}.`);
    setIsBusy(false);
    onOpenChange(false);
    router.refresh();
  };

  return (
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
          <dd className="font-medium">{item.clientName ?? "-"}</dd>

          <dt className="text-muted-foreground">Subject</dt>
          <dd className="font-medium">{item.subject || "-"}</dd>

          <dt className="text-muted-foreground">Amount</dt>
          <dd className="font-medium">{formatCurrency(item.amount)}</dd>

          <dt className="text-muted-foreground">Cost</dt>
          <dd className="font-medium">{formatCurrency(item.cost ?? null)}</dd>

          <dt className="text-muted-foreground">Margin</dt>
          <dd className="font-medium">{formatCurrency(item.marginAmount ?? null)}</dd>

          <dt className="text-muted-foreground">Sector</dt>
          <dd className="font-medium capitalize">{item.sector ?? "-"}</dd>

          <dt className="text-muted-foreground">Required Role</dt>
          <dd className="font-medium capitalize">
            {item.approverRole.replaceAll("_", " ")}
          </dd>

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

          <dt className="text-muted-foreground">Notes</dt>
          <dd className="font-medium">{item.notes ?? "-"}</dd>

          <dt className="text-muted-foreground">Created</dt>
          <dd className="font-medium">{formatDate(item.createdAt)}</dd>
        </dl>

        <div className="space-y-2 pt-2">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason required for reject"
            aria-label={`Rejection reason for ${item.quotationNumber}`}
            disabled={isBusy || !canApprove}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleReject}
              disabled={isBusy || !canApprove}
            >
              Reject
            </Button>
            <Button type="button" onClick={handleApprove} disabled={isBusy || !canApprove}>
              {isBusy ? "Saving..." : "Approve"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
