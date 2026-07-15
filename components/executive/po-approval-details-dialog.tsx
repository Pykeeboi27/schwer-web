"use client";

import {
  approvePurchaseOrderAction,
  rejectPurchaseOrderAction,
} from "@/app/protected/sales/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PendingPoApprovalItem } from "@/lib/sales/purchase-orders";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PoApprovalDetailsDialogProps = {
  item: PendingPoApprovalItem | null;
  currentUserRole: string | null;
  onOpenChange: (open: boolean) => void;
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PoApprovalDetailsDialog({
  item,
  currentUserRole,
  onOpenChange,
}: PoApprovalDetailsDialogProps) {
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
      error("Only owner or executive roles can approve high-value purchase orders.");
      return;
    }
    setIsBusy(true);
    const response = await approvePurchaseOrderAction(item.poId, normalizedRole);
    if (!response.success) {
      error(response.error ?? "Failed to approve purchase order.");
      setIsBusy(false);
      return;
    }
    success(`Approved ${item.poNumber}.`);
    setIsBusy(false);
    onOpenChange(false);
    router.refresh();
  };

  const handleReject = async () => {
    if (!canApprove) {
      error("Only owner or executive roles can reject high-value purchase orders.");
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      error("Please provide a rejection reason.");
      return;
    }
    setIsBusy(true);
    const response = await rejectPurchaseOrderAction(
      item.poId,
      trimmedReason,
      normalizedRole,
    );
    if (!response.success) {
      error(response.error ?? "Failed to reject purchase order.");
      setIsBusy(false);
      return;
    }
    success(`Rejected ${item.poNumber}.`);
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
          <DialogTitle className="font-mono">{item.poNumber}</DialogTitle>
        </DialogHeader>

        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Client</dt>
          <dd className="font-medium">{item.clientName ?? "-"}</dd>

          <dt className="text-muted-foreground">Authored By</dt>
          <dd className="font-medium">{item.createdByName ?? "-"}</dd>

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

          <dt className="text-muted-foreground">PO Date</dt>
          <dd className="font-medium">{formatDate(item.poDate)}</dd>
        </dl>

        <div className="space-y-2 pt-2">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason required for reject"
            aria-label={`Rejection reason for ${item.poNumber}`}
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
            <Button
              type="button"
              onClick={handleApprove}
              disabled={isBusy || !canApprove}
            >
              {isBusy ? "Saving..." : "Approve"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
