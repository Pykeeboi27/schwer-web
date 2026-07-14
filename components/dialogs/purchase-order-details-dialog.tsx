"use client";

import {
  approvePurchaseOrderAction,
  rejectPurchaseOrderAction,
  resubmitPurchaseOrderAction,
  updatePurchaseOrderDetailsAction,
} from "@/app/protected/sales/purchase-orders/actions";
import { RecordCollectionDialog } from "@/components/dialogs/record-collection-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/patterns";
import { computeSalesPricing } from "@/lib/sales/pricing";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { cn } from "@/lib/utils";
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

const PAYMENT_TERMS_OPTIONS = [
  "50% Down Payment, 50% Upon Delivery",
  "15 Days",
  "30 Days",
  "Other",
] as const;

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

function progressOf(purchaseOrder: SalesPurchaseOrder): number {
  if (purchaseOrder.poAmount <= 0) return 0;
  return Math.min(
    100,
    Math.round((purchaseOrder.recognizedAmount / purchaseOrder.poAmount) * 100),
  );
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
  const [editClientPoNumber, setEditClientPoNumber] = useState("");
  const [editQuotationReference, setEditQuotationReference] = useState("");
  const [marginPercentage, setMarginPercentage] = useState("");
  const [bankPercentage, setBankPercentage] = useState("");
  const [sopPercentage, setSopPercentage] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [paymentTermsSelect, setPaymentTermsSelect] = useState("");
  const [paymentTermsCustom, setPaymentTermsCustom] = useState("");

  const normalizedRole = String(currentUserRole ?? "")
    .trim()
    .toLowerCase();

  // Only the sales person who created (converted) the PO may edit or record
  // collections against it; everyone else in the department sees the same
  // details read-only (approvers are exempt — see canApproveReject below).
  const isOwner = Boolean(purchaseOrder && purchaseOrder.createdBy === currentUserId);

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
    if (!open || !purchaseOrder) {
      return;
    }
    setEditClientPoNumber(purchaseOrder.clientPoNumber ?? "");
    setEditQuotationReference(purchaseOrder.quotationReference ?? "");
    setMarginPercentage(
      purchaseOrder.marginPercentage === null
        ? ""
        : String(purchaseOrder.marginPercentage),
    );
    setBankPercentage(
      purchaseOrder.bankPercentage === null ? "" : String(purchaseOrder.bankPercentage),
    );
    setSopPercentage(
      purchaseOrder.sopPercentage === null ? "" : String(purchaseOrder.sopPercentage),
    );
    setLeadTimeDays(
      purchaseOrder.leadTimeDays === null ? "" : String(purchaseOrder.leadTimeDays),
    );

    // Map the stored payment terms back onto the dropdown + custom field.
    const storedTerms = purchaseOrder.paymentTerms ?? "";
    if (
      storedTerms !== "" &&
      !PAYMENT_TERMS_OPTIONS.includes(
        storedTerms as (typeof PAYMENT_TERMS_OPTIONS)[number],
      )
    ) {
      setPaymentTermsSelect("Other");
      setPaymentTermsCustom(purchaseOrder.paymentTermsCustom ?? storedTerms);
    } else if (storedTerms === "Other") {
      setPaymentTermsSelect("Other");
      setPaymentTermsCustom(purchaseOrder.paymentTermsCustom ?? "");
    } else {
      setPaymentTermsSelect(storedTerms);
      setPaymentTermsCustom("");
    }
  }, [open, purchaseOrder]);

  if (!purchaseOrder) {
    return null;
  }

  const isRejected = purchaseOrder.status === "rejected";
  const isApproved = purchaseOrder.status === "approved";
  const isEditable = isRejected && isOwner;
  const canApproveReject =
    purchaseOrder.status === "pending" &&
    purchaseOrder.pendingApprovalRoles.includes(
      normalizedRole as "sales_manager" | "owner" | "executive",
    );

  const directCost = purchaseOrder.cost ?? 0;
  const pricingPreview = computeSalesPricing({
    directCost,
    marginPercentage: Number(marginPercentage) || 0,
    bankPercentage: Number(bankPercentage) || 0,
    sopPercentage: Number(sopPercentage) || 0,
  });

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

  const handleSaveDetails = async () => {
    const trimmedMargin = marginPercentage.trim();
    const trimmedBank = bankPercentage.trim();
    const trimmedSop = sopPercentage.trim();
    const trimmedLeadTime = leadTimeDays.trim();

    for (const [label, raw] of [
      ["Margin", trimmedMargin],
      ["Bank", trimmedBank],
      ["SOP", trimmedSop],
    ] as const) {
      if (raw !== "") {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          error(`${label} percentage must be 0 or greater.`);
          return;
        }
      }
    }

    if (trimmedLeadTime !== "") {
      const days = Number(trimmedLeadTime);
      if (!Number.isFinite(days) || !Number.isInteger(days) || days < 0) {
        error("Lead time must be a whole number of days (0 or greater).");
        return;
      }
    }

    if (paymentTermsSelect === "Other" && paymentTermsCustom.trim() === "") {
      error("Please enter the custom payment terms.");
      return;
    }

    setIsSubmitting(true);
    const response = await updatePurchaseOrderDetailsAction(purchaseOrder.id, {
      marginPercentage: trimmedMargin,
      bankPercentage: trimmedBank,
      sopPercentage: trimmedSop,
      paymentTerms: paymentTermsSelect.trim(),
      paymentTermsCustom: paymentTermsCustom.trim(),
      leadTimeDays: trimmedLeadTime,
      clientPoNumber: editClientPoNumber.trim(),
      quotationReference: editQuotationReference.trim(),
    });
    if (!response.success) {
      error(response.error ?? "Failed to save purchase order details.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order details saved.");
    setIsSubmitting(false);
    router.refresh();
  };

  const handleResubmit = async () => {
    setIsSubmitting(true);
    const response = await resubmitPurchaseOrderAction(purchaseOrder.id);
    if (!response.success) {
      error(response.error ?? "Failed to resubmit purchase order.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order resubmitted for approval.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] max-w-2xl overflow-y-auto",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          )}
        >
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>
              {!isOwner && !canApproveReject
                ? "This purchase order belongs to another sales person and is read-only."
                : isRejected
                  ? "This purchase order was rejected. Update the pricing, then resubmit for approval."
                  : "Review details and process approval actions."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                window.open(
                  `/api/sales/purchase-orders/${purchaseOrder.id}/worksheet`,
                  "_blank",
                )
              }
            >
              Download Worksheet
            </Button>
          </div>

          {/* Overview */}
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <h3 className="text-base font-semibold">Overview</h3>
            <dl className="grid gap-3">
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">PO #</dt>
                <dd className="font-medium">{purchaseOrder.poNumber}</dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Client PO #</dt>
                <dd>
                  {isEditable ? (
                    <Input
                      value={editClientPoNumber}
                      onChange={(e) =>
                        setEditClientPoNumber(e.target.value.toUpperCase())
                      }
                      placeholder="Client PO number"
                      className="h-8"
                    />
                  ) : (
                    (purchaseOrder.clientPoNumber ?? "—")
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Quotation Ref.</dt>
                <dd>
                  {isEditable ? (
                    <Input
                      value={editQuotationReference}
                      onChange={(e) =>
                        setEditQuotationReference(e.target.value.toUpperCase())
                      }
                      placeholder="Quotation reference"
                      className="h-8"
                    />
                  ) : (
                    (purchaseOrder.quotationReference ?? "—")
                  )}
                </dd>
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
                <dd className="flex flex-wrap items-center gap-x-1">
                  <StatusBadge status={purchaseOrder.status} />
                  {purchaseOrder.status === "pending" &&
                  purchaseOrder.pendingApprovalRoles.length > 0
                    ? ` · awaiting ${purchaseOrder.pendingApprovalRoles.join(" -> ")}`
                    : ""}
                </dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Approved At</dt>
                <dd>{formatDateTime(purchaseOrder.approvedAt)}</dd>
              </div>
            </dl>
          </div>

          {/* Pricing Breakdown */}
          <div className="mt-4 space-y-3 rounded-md border p-4 text-sm">
            <h3 className="text-base font-semibold">Pricing Breakdown</h3>

            {isEditable ? (
              <div className="space-y-4">
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <Label className="text-muted-foreground">Direct Cost</Label>
                  <span className="font-medium">{formatCurrency(directCost)}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="po-margin-percent">Margin %</Label>
                    <NumberInput
                      id="po-margin-percent"
                      value={marginPercentage}
                      onValueChange={setMarginPercentage}
                      className="mt-1"
                      placeholder="e.g. 25"
                    />
                  </div>
                  <div>
                    <Label>Margin Amount</Label>
                    <Input
                      value={formatCurrency(pricingPreview.marginAmount)}
                      readOnly
                      className="mt-1 bg-muted/40"
                    />
                  </div>
                  <div>
                    <Label htmlFor="po-bank-percent">Bank %</Label>
                    <NumberInput
                      id="po-bank-percent"
                      value={bankPercentage}
                      onValueChange={setBankPercentage}
                      className="mt-1"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <Label>Bank Amount</Label>
                    <Input
                      value={formatCurrency(pricingPreview.bankAmount)}
                      readOnly
                      className="mt-1 bg-muted/40"
                    />
                  </div>
                  <div>
                    <Label htmlFor="po-sop-percent">SOP %</Label>
                    <NumberInput
                      id="po-sop-percent"
                      value={sopPercentage}
                      onValueChange={setSopPercentage}
                      className="mt-1"
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div>
                    <Label>SOP Amount</Label>
                    <Input
                      value={formatCurrency(pricingPreview.sopAmount)}
                      readOnly
                      className="mt-1 bg-muted/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2 border-t pt-3">
                  <Label className="font-semibold">Selling / Total Amount</Label>
                  <span className="text-base font-semibold">
                    {formatCurrency(pricingPreview.sellingAmount)}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="po-lead-time">Lead Time (days)</Label>
                    <Input
                      id="po-lead-time"
                      type="number"
                      min={0}
                      step="1"
                      value={leadTimeDays}
                      onChange={(event) => setLeadTimeDays(event.target.value)}
                      className="mt-1"
                      placeholder="e.g. 30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="po-payment-terms">Payment Terms</Label>
                    <Select
                      value={paymentTermsSelect || undefined}
                      onValueChange={(value) => setPaymentTermsSelect(value)}
                    >
                      <SelectTrigger id="po-payment-terms" className="mt-1">
                        <SelectValue placeholder="Select payment terms" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {paymentTermsSelect === "Other" ? (
                  <div>
                    <Label htmlFor="po-payment-terms-custom">Custom Payment Terms</Label>
                    <Input
                      id="po-payment-terms-custom"
                      value={paymentTermsCustom}
                      onChange={(event) => setPaymentTermsCustom(event.target.value)}
                      className="mt-1"
                      placeholder="Describe the agreed payment terms"
                    />
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    onClick={handleSaveDetails}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button onClick={handleResubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit for Approval"}
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-3">
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">Direct Cost</dt>
                  <dd>
                    {purchaseOrder.cost === null
                      ? "—"
                      : formatCurrency(purchaseOrder.cost)}
                  </dd>
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
                  <dt className="text-muted-foreground">Bank</dt>
                  <dd>
                    {formatPercent(purchaseOrder.bankPercentage)}
                    {purchaseOrder.bankAmount !== null
                      ? ` · ${formatCurrency(purchaseOrder.bankAmount)}`
                      : ""}
                  </dd>
                </div>
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">SOP</dt>
                  <dd>
                    {formatPercent(purchaseOrder.sopPercentage)}
                    {purchaseOrder.sopAmount !== null
                      ? ` · ${formatCurrency(purchaseOrder.sopAmount)}`
                      : ""}
                  </dd>
                </div>
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">Selling Amount</dt>
                  <dd>
                    {purchaseOrder.sellingAmount === null
                      ? "—"
                      : formatCurrency(purchaseOrder.sellingAmount)}
                  </dd>
                </div>
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">Total Amount</dt>
                  <dd className="font-semibold">
                    {formatCurrency(purchaseOrder.poAmount)}
                  </dd>
                </div>
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">Payment Terms</dt>
                  <dd>
                    {purchaseOrder.paymentTerms === "Other"
                      ? (purchaseOrder.paymentTermsCustom ?? "Other")
                      : (purchaseOrder.paymentTerms ?? "—")}
                  </dd>
                </div>
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">Lead Time</dt>
                  <dd>
                    {purchaseOrder.leadTimeDays === null
                      ? "—"
                      : `${purchaseOrder.leadTimeDays} day${
                          purchaseOrder.leadTimeDays === 1 ? "" : "s"
                        }`}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {canApproveReject ? (
            <div className="mt-4 space-y-3 rounded-md border bg-muted/20 p-4">
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

          {/* Payment */}
          <div className="mt-4 space-y-3 rounded-md border p-4 text-sm">
            <h3 className="text-base font-semibold">Payment</h3>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Collected {formatCurrency(purchaseOrder.recognizedAmount)} of{" "}
                {formatCurrency(purchaseOrder.poAmount)} ({progressOf(purchaseOrder)}%)
              </p>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${progressOf(purchaseOrder)}%` }}
                />
              </div>
            </div>

            <dl className="grid gap-3">
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Total Amount</dt>
                <dd className="font-semibold">
                  {formatCurrency(purchaseOrder.poAmount)}
                </dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Collected Amount</dt>
                <dd>{formatCurrency(purchaseOrder.recognizedAmount)}</dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Remaining Balance</dt>
                <dd>
                  {formatCurrency(
                    Math.max(purchaseOrder.poAmount - purchaseOrder.recognizedAmount, 0),
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Payment Status</dt>
                <dd>
                  <StatusBadge status={purchaseOrder.paymentStatus} />
                </dd>
              </div>
            </dl>

            {isApproved ? (
              <div className="mt-2">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Collection History</h4>
                  {isOwner ? (
                    <Button type="button" onClick={() => setRecordDialogOpen(true)}>
                      Record Collection
                    </Button>
                  ) : null}
                </div>

                <div className="max-h-64 space-y-2 overflow-auto rounded border p-3">
                  {paymentHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No collections recorded yet.
                    </p>
                  ) : (
                    paymentHistory.map((payment) => (
                      <div key={payment.id} className="rounded border p-2 text-sm">
                        <p className="font-medium">
                          {formatCurrency(payment.amountCollected)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.paymentDate).toLocaleDateString()}
                          {payment.paymentMethod ? ` • ${payment.paymentMethod}` : ""}
                          {payment.referenceNumber ? ` • ${payment.referenceNumber}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                {!isOwner ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Only the sales person who owns this purchase order can record
                    collections.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <RecordCollectionDialog
        open={recordDialogOpen}
        purchaseOrder={purchaseOrder}
        onOpenChange={setRecordDialogOpen}
      />
    </>
  );
}
