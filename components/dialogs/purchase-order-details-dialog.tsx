"use client";

import {
  approvePurchaseOrderAction,
  rejectPurchaseOrderAction,
} from "@/app/protected/sales/purchase-orders/actions";
import { RecordCollectionDialog } from "@/components/dialogs/record-collection-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PurchaseOrderDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: SalesPurchaseOrder | null;
  payments: SalesPoPayment[];
  currentUserId: string;
  currentUserRole: string | null;
};

const APPROVAL_LABELS: Record<SalesPurchaseOrder["status"], string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

export function PurchaseOrderDetailsDialog({
  open,
  onOpenChange,
  purchaseOrder,
  payments,
  currentUserId,
  currentUserRole,
}: PurchaseOrderDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  void currentUserId;
  const normalizedRole = String(currentUserRole ?? "").trim().toLowerCase();

  const paymentHistory = useMemo(() => {
    if (!purchaseOrder) {
      return [];
    }
    return payments.filter((payment) => payment.purchaseOrderId === purchaseOrder.id);
  }, [payments, purchaseOrder]);

  const handleClose = () => {
    setRecordDialogOpen(false);
    setRejectionReason("");
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRecordDialogOpen(false);
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open || !purchaseOrder) {
    return null;
  }

  const isApproved = purchaseOrder.status === "approved";
  const canApproveReject =
    purchaseOrder.status === "pending" &&
    purchaseOrder.pendingApprovalRoles.includes(
      normalizedRole as "sales_manager" | "owner" | "executive",
    );

  const handleApprove = async () => {
    setIsSubmitting(true);
    const response = await approvePurchaseOrderAction(purchaseOrder.id, normalizedRole);
    if (!response.success) {
      error(response.error ?? "Failed to approve purchase order.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order approved.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    if (rejectionReason.trim() === "") {
      error("Please provide a rejection reason.");
      return;
    }
    setIsSubmitting(true);
    const response = await rejectPurchaseOrderAction(
      purchaseOrder.id,
      rejectionReason.trim(),
      normalizedRole,
    );
    if (!response.success) {
      error(response.error ?? "Failed to reject purchase order.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order rejected.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-order-details-title"
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-5 shadow-lg"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="purchase-order-details-title" className="text-xl font-semibold">
                Purchase Order Details
              </h2>
              <p className="text-sm text-muted-foreground">
                Converted from quotation; routed through the PO approval workflow.
              </p>
            </div>
            <Button variant="ghost" onClick={handleClose} aria-label="Close purchase order details dialog">
              Close
            </Button>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">PO #</dt>
              <dd className="font-medium">{purchaseOrder.poNumber}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Client PO #</dt>
              <dd>{purchaseOrder.clientPoNumber ?? "—"}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Client</dt>
              <dd>{purchaseOrder.clientName}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Subject</dt>
              <dd>{purchaseOrder.subject}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Approval Status</dt>
              <dd>
                <Badge variant="outline">{APPROVAL_LABELS[purchaseOrder.status]}</Badge>
                {purchaseOrder.status === "pending" && purchaseOrder.pendingApprovalRoles.length > 0
                  ? ` · awaiting ${purchaseOrder.pendingApprovalRoles.join(" -> ")}`
                  : ""}
              </dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Direct Cost</dt>
              <dd>{purchaseOrder.cost === null ? "—" : formatCurrency(purchaseOrder.cost)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Margin</dt>
              <dd>
                {formatPercent(purchaseOrder.marginPercentage)}
                {purchaseOrder.marginAmount !== null
                  ? ` · ${formatCurrency(purchaseOrder.marginAmount)}`
                  : ""}
              </dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Total Amount</dt>
              <dd className="font-semibold">{formatCurrency(purchaseOrder.poAmount)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Collected Amount</dt>
              <dd>{formatCurrency(purchaseOrder.recognizedAmount)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Payment Terms</dt>
              <dd>
                {purchaseOrder.paymentTerms === "Other"
                  ? purchaseOrder.paymentTermsCustom ?? "Other"
                  : purchaseOrder.paymentTerms ?? "—"}
              </dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Lead Time</dt>
              <dd>
                {purchaseOrder.leadTimeDays === null
                  ? "—"
                  : `${purchaseOrder.leadTimeDays} day${purchaseOrder.leadTimeDays === 1 ? "" : "s"}`}
              </dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Approved At</dt>
              <dd>{formatDateTime(purchaseOrder.approvedAt)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Payment Status</dt>
              <dd>{purchaseOrder.paymentStatus}</dd>
            </div>
          </dl>

          {canApproveReject ? (
            <div className="mt-5 space-y-3 rounded-md border bg-muted/20 p-4">
              <h3 className="text-base font-semibold">PO Approval</h3>
              <Input
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Rejection reason (required for reject)"
                aria-label="Rejection reason"
              />
              <div className="flex justify-end gap-2">
                <Button onClick={handleApprove} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Approve"}
                </Button>
                <Button variant="outline" onClick={handleReject} disabled={isSubmitting}>
                  Reject
                </Button>
              </div>
            </div>
          ) : null}

          {isApproved ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold">Collection History</h3>
                <Button type="button" onClick={() => setRecordDialogOpen(true)}>
                  Record Collection
                </Button>
              </div>

              <div className="max-h-64 space-y-2 overflow-auto rounded border p-3">
                {paymentHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No collections recorded yet.</p>
                ) : (
                  paymentHistory.map((payment) => (
                    <div key={payment.id} className="rounded border p-2 text-sm">
                      <p className="font-medium">{formatCurrency(payment.amountCollected)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                        {payment.paymentMethod ? ` • ${payment.paymentMethod}` : ""}
                        {payment.referenceNumber ? ` • ${payment.referenceNumber}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <RecordCollectionDialog
        open={recordDialogOpen}
        purchaseOrder={purchaseOrder}
        onOpenChange={setRecordDialogOpen}
      />
    </>
  );
}
