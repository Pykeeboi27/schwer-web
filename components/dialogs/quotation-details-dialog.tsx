"use client";

import {
  approveQuotationAction,
  rejectQuotationAction,
  submitQuotationForApprovalAction,
  updateSalesQuotationDetailsAction,
} from "@/app/protected/sales/quotations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type QuotationDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: SalesQuotation | null;
  currentUserId: string;
  currentUserRole: string | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
}

function formatLeadTime(days: number | null): string {
  if (days === null) {
    return "—";
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

function computedMarginPercent(amount: number, cost: number | null): string {
  if (cost === null || amount <= 0) {
    return "—";
  }
  const value = ((amount - cost) / amount) * 100;
  return `${value.toFixed(2)}%`;
}

function statusLabel(status: SalesQuotation["status"]): string {
  if (status === "draft") {
    return "Draft";
  }

  if (status === "pending") {
    return "Pending Approval";
  }

  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Cancelled";
}

export function QuotationDetailsDialog({
  open,
  onOpenChange,
  quotation,
  currentUserId,
  currentUserRole,
}: QuotationDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [marginPercent, setMarginPercent] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");

  const normalizedRole = useMemo(
    () => String(currentUserRole ?? "").trim().toLowerCase(),
    [currentUserRole],
  );

  void currentUserId;

  const isDraft = quotation?.status === "draft";

  const canApproveReject =
    quotation?.status === "pending" &&
    quotation.pendingApprovalRoles.includes(
      normalizedRole as "sales_manager" | "owner" | "executive",
    );

  const pendingApprovalText =
    quotation && quotation.pendingApprovalRoles.length > 0
      ? quotation.pendingApprovalRoles.join(" -> ")
      : "No pending approvers";

  const handleClose = () => {
    onOpenChange(false);
    setRejectionReason("");
  };

  useEffect(() => {
    if (!quotation || !open) {
      return;
    }

    setMarginPercent(
      quotation.salesMarginPercent === null ? "" : String(quotation.salesMarginPercent),
    );
    setPaymentTerms(quotation.paymentTerms ?? "");
    setLeadTimeDays(
      quotation.leadTimeDays === null ? "" : String(quotation.leadTimeDays),
    );
    setNotes(quotation.notes ?? "");
  }, [quotation, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        setRejectionReason("");
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || !quotation) {
    return null;
  }

  const salesDetailsComplete =
    marginPercent.trim() !== "" &&
    paymentTerms.trim() !== "" &&
    leadTimeDays.trim() !== "";

  const handleSaveSalesDetails = async () => {
    const trimmedMargin = marginPercent.trim();
    const trimmedPaymentTerms = paymentTerms.trim();
    const trimmedLeadTime = leadTimeDays.trim();

    if (trimmedMargin !== "") {
      const margin = Number(trimmedMargin);
      if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
        error("Margin must be between 0 and 100.");
        return;
      }
    }

    if (trimmedLeadTime !== "") {
      const days = Number(trimmedLeadTime);
      if (!Number.isFinite(days) || !Number.isInteger(days) || days < 0) {
        error("Lead time must be a whole number of days (0 or greater).");
        return;
      }
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("quotationId", quotation.id);
    formData.set("salesMarginPercent", trimmedMargin);
    formData.set("paymentTerms", trimmedPaymentTerms);
    formData.set("leadTimeDays", trimmedLeadTime);
    formData.set("notes", notes.trim());

    const response = await updateSalesQuotationDetailsAction(formData);
    if (!response.success) {
      error(response.error ?? "Failed to update sales details.");
      setIsSubmitting(false);
      return;
    }

    success("Sales details saved.");
    setIsSubmitting(false);
    router.refresh();
  };

  const handleSubmitForApproval = async () => {
    if (!salesDetailsComplete) {
      error("Margin, payment terms, and lead time are required before submitting.");
      return;
    }

    setIsSubmitting(true);

    const response = await submitQuotationForApprovalAction(quotation.id);
    if (!response.success) {
      error(response.error ?? "Failed to submit quotation for approval.");
      setIsSubmitting(false);
      return;
    }

    success("Quotation submitted for approval.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleApprove = async () => {
    setIsSubmitting(true);

    const response = await approveQuotationAction(quotation.id, normalizedRole);
    if (!response.success) {
      error(response.error ?? "Failed to approve quotation.");
      setIsSubmitting(false);
      return;
    }

    success("Quotation approved successfully.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    const normalizedReason = rejectionReason.trim();

    if (!normalizedReason) {
      error("Please provide a rejection reason.");
      return;
    }

    setIsSubmitting(true);

    const response = await rejectQuotationAction(
      quotation.id,
      normalizedReason,
      normalizedRole,
    );
    if (!response.success) {
      error(response.error ?? "Failed to reject quotation.");
      setIsSubmitting(false);
      return;
    }

    success("Quotation rejected.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotation-details-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="quotation-details-title" className="text-xl font-semibold">
              Quotation Details
            </h2>
            <p className="text-sm text-muted-foreground">
              {isDraft
                ? "Add the sales details, then submit for approval."
                : "Review details and process approval actions."}
            </p>
          </div>
          <Button variant="ghost" onClick={handleClose} aria-label="Close quotation details dialog">
            Close
          </Button>
        </div>

        <dl className="grid gap-3 text-sm">
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Quotation ID</dt>
            <dd className="font-medium">{quotation.quotationNumber}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{quotation.clientName}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Subject</dt>
            <dd>{quotation.subject}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Amount</dt>
            <dd>{formatCurrency(quotation.amount)}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Cost</dt>
            <dd>{quotation.cost === null ? "-" : formatCurrency(quotation.cost)}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Computed Margin</dt>
            <dd>{computedMarginPercent(quotation.amount, quotation.cost)}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{statusLabel(quotation.status)}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Approval Chain</dt>
            <dd>{pendingApprovalText}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(quotation.createdAt).toLocaleString()}</dd>
          </div>
        </dl>

        {isDraft ? (
          <div className="mt-5 space-y-3 rounded-md border bg-muted/20 p-4 text-sm">
            <h3 className="text-base font-semibold">Sales Details</h3>
            <p className="text-xs text-muted-foreground">
              All three fields are required before this quotation can be submitted for approval.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="sales-margin-percent">Sales Margin %</Label>
                <Input
                  id="sales-margin-percent"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={marginPercent}
                  onChange={(event) => setMarginPercent(event.target.value)}
                  className="mt-1"
                  placeholder="e.g. 25"
                />
              </div>
              <div>
                <Label htmlFor="sales-lead-time">Lead Time (days)</Label>
                <Input
                  id="sales-lead-time"
                  type="number"
                  min={0}
                  step="1"
                  value={leadTimeDays}
                  onChange={(event) => setLeadTimeDays(event.target.value)}
                  className="mt-1"
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sales-payment-terms">Payment Terms</Label>
              <Input
                id="sales-payment-terms"
                value={paymentTerms}
                onChange={(event) => setPaymentTerms(event.target.value)}
                className="mt-1"
                placeholder="e.g. Net 30"
              />
            </div>

            <div>
              <Label htmlFor="sales-notes">Notes</Label>
              <Input
                id="sales-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        ) : (
          <dl className="mt-5 grid gap-3 rounded-md border bg-muted/20 p-4 text-sm">
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Sales Margin %</dt>
              <dd>{formatPercent(quotation.salesMarginPercent)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Payment Terms</dt>
              <dd>{quotation.paymentTerms ?? "—"}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Lead Time</dt>
              <dd>{formatLeadTime(quotation.leadTimeDays)}</dd>
            </div>
            {quotation.notes ? (
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Notes</dt>
                <dd>{quotation.notes}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {canApproveReject ? (
          <div className="mt-4 space-y-3">
            <Input
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Rejection reason (required for reject)"
              aria-label="Rejection reason"
            />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {isDraft ? (
            <>
              <Button variant="outline" onClick={handleSaveSalesDetails} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Sales Details"}
              </Button>
              <Button
                onClick={handleSubmitForApproval}
                disabled={isSubmitting || !salesDetailsComplete}
              >
                {isSubmitting ? "Submitting..." : "Submit for Approval"}
              </Button>
            </>
          ) : null}

          {canApproveReject ? (
            <>
              <Button onClick={handleApprove} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Approve"}
              </Button>
              <Button variant="outline" onClick={handleReject} disabled={isSubmitting}>
                Reject
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
