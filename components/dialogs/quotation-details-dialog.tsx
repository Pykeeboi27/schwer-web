"use client";

import {
  approveQuotationAction,
  deleteQuotationDraftAction,
  rejectQuotationAction,
  submitQuotationForApprovalAction,
  updateQuotationDraftAction,
} from "@/app/protected/sales/quotations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SalesQuotation } from "@/lib/sales/quotations";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type QuotationDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: SalesQuotation | null;
  currentUserId: string;
  currentUserRole: string | null;
  clients: ClientOption[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
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
  clients,
}: QuotationDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftClientId, setDraftClientId] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftCost, setDraftCost] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  const normalizedRole = useMemo(
    () => String(currentUserRole ?? "").trim().toLowerCase(),
    [currentUserRole],
  );

  const canSubmitForApproval =
    quotation?.status === "draft" && quotation.preparedBy === currentUserId;

  const canManageDraft =
    quotation?.status === "draft" && quotation.preparedBy === currentUserId;

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
    setIsEditingDraft(false);
  };

  useEffect(() => {
    if (!quotation || !open) {
      return;
    }

    setDraftClientId(quotation.clientId);
    setDraftSubject(quotation.subject);
    setDraftAmount(String(quotation.amount));
    setDraftCost(quotation.cost === null ? "" : String(quotation.cost));
    setDraftNotes(quotation.notes ?? "");
    setIsEditingDraft(false);
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

  const handleSubmitForApproval = async () => {
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

  const handleSaveDraftChanges = async () => {
    const normalizedClientId = draftClientId.trim();
    const normalizedSubject = draftSubject.trim();

    if (!normalizedClientId) {
      error("Please select a client.");
      return;
    }

    if (!normalizedSubject) {
      error("Subject is required.");
      return;
    }

    const amount = Number(draftAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      error("Amount must be greater than 0.");
      return;
    }

    if (draftCost.trim()) {
      const cost = Number(draftCost);
      if (!Number.isFinite(cost) || cost < 0) {
        error("Cost must be 0 or greater.");
        return;
      }
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("quotationId", quotation.id);
    formData.set("clientId", normalizedClientId);
    formData.set("subject", normalizedSubject);
    formData.set("amount", String(amount));
    formData.set("cost", draftCost.trim());
    formData.set("notes", draftNotes.trim());

    const response = await updateQuotationDraftAction(formData);
    if (!response.success) {
      error(response.error ?? "Failed to update quotation draft.");
      setIsSubmitting(false);
      return;
    }

    success("Draft quotation updated.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleDeleteDraft = async () => {
    if (!window.confirm("Delete this draft quotation? This action cannot be undone.")) {
      return;
    }

    setIsSubmitting(true);
    const response = await deleteQuotationDraftAction(quotation.id);

    if (!response.success) {
      error(response.error ?? "Failed to delete quotation draft.");
      setIsSubmitting(false);
      return;
    }

    success("Draft quotation deleted.");
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
        className="w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="quotation-details-title" className="text-xl font-semibold">
              Quotation Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Review details and process approval actions.
            </p>
          </div>
          <Button variant="ghost" onClick={handleClose} aria-label="Close quotation details dialog">
            Close
          </Button>
        </div>

        {isEditingDraft ? (
          <div className="grid gap-3 text-sm">
            <div>
              <Label htmlFor="edit-quotation-client">Client</Label>
              <select
                id="edit-quotation-client"
                value={draftClientId}
                onChange={(event) => setDraftClientId(event.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {clients
                  .filter((client) => client.isActive || client.id === quotation.clientId)
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label htmlFor="edit-quotation-subject">Subject</Label>
              <Input
                id="edit-quotation-subject"
                value={draftSubject}
                onChange={(event) => setDraftSubject(event.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-quotation-amount">Amount</Label>
                <Input
                  id="edit-quotation-amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={draftAmount}
                  onChange={(event) => setDraftAmount(event.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-quotation-cost">Cost</Label>
                <Input
                  id="edit-quotation-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftCost}
                  onChange={(event) => setDraftCost(event.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-quotation-notes">Notes</Label>
              <Input
                id="edit-quotation-notes"
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{statusLabel(quotation.status)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(quotation.createdAt).toLocaleString()}</dd>
            </div>
          </div>
        ) : (
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
          {canManageDraft && !isEditingDraft ? (
            <Button variant="outline" onClick={() => setIsEditingDraft(true)} disabled={isSubmitting}>
              Edit Draft
            </Button>
          ) : null}

          {canManageDraft && isEditingDraft ? (
            <>
              <Button variant="outline" onClick={() => setIsEditingDraft(false)} disabled={isSubmitting}>
                Cancel Edit
              </Button>
              <Button onClick={handleSaveDraftChanges} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Draft Changes"}
              </Button>
            </>
          ) : null}

          {canManageDraft && !isEditingDraft ? (
            <Button variant="outline" onClick={handleDeleteDraft} disabled={isSubmitting}>
              Delete Draft
            </Button>
          ) : null}

          {canSubmitForApproval ? (
            <Button onClick={handleSubmitForApproval} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit for Approval"}
            </Button>
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