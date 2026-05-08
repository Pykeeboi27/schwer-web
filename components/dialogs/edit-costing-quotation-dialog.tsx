"use client";

import { updateCostingQuotationAction } from "@/app/protected/engineering/quotations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type EditCostingQuotationDialogProps = {
  open: boolean;
  quotation: CostingQuotation | null;
  clients: ClientOption[];
  onOpenChange: (open: boolean) => void;
};

type FieldErrors = {
  clientId?: string;
  subject?: string;
  amount?: string;
  cost?: string;
  googleDriveLink?: string;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function EditCostingQuotationDialog({
  open,
  quotation,
  clients,
  onOpenChange,
}: EditCostingQuotationDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const dialogTitleId = useMemo(() => "edit-costing-quotation-dialog-title", []);

  const activeClients = useMemo(
    () => clients.filter((c) => c.isActive || c.id === quotation?.clientId),
    [clients, quotation],
  );

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setFormError(null);
      setFieldErrors({});
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open || !quotation) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    formData.set("quotationId", quotation.id);

    const nextErrors: FieldErrors = {};
    const clientId = String(formData.get("clientId") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const amountText = String(formData.get("amount") ?? "").trim();
    const costText = String(formData.get("cost") ?? "").trim();
    const driveLink = String(formData.get("googleDriveLink") ?? "").trim();

    if (!clientId) nextErrors.clientId = "Client is required.";
    if (!subject) nextErrors.subject = "Subject is required.";

    const amount = Number(amountText);
    if (!amountText || !Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = "Amount must be greater than 0.";
    }

    const cost = Number(costText);
    if (!costText || !Number.isFinite(cost) || cost < 0) {
      nextErrors.cost = "Cost must be 0 or greater.";
    }

    if (!driveLink) {
      nextErrors.googleDriveLink = "Google Drive link is required.";
    } else if (!isHttpUrl(driveLink)) {
      nextErrors.googleDriveLink = "Must be a valid http or https URL.";
    }

    if (Object.keys(nextErrors).length > 0) {
      const message = "Please correct the highlighted fields.";
      setFieldErrors(nextErrors);
      setFormError(message);
      error(message);
      return;
    }

    setIsSubmitting(true);
    const response = await updateCostingQuotationAction(formData);

    if (!response.success) {
      const message = response.error ?? "Failed to update costing quotation.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    success("Costing quotation updated.");
    onOpenChange(false);
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={dialogTitleId} className="text-xl font-semibold">
              Edit Costing Quotation
            </h2>
            <p className="text-sm text-muted-foreground">
              Quotation {quotation.quotationNumber}
            </p>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close dialog">
            Close
          </Button>
        </div>

        {quotation.costingRejectionReason ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">Rejected by executive</p>
            <p className="mt-1 text-foreground">{quotation.costingRejectionReason}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-client">Client</Label>
            <select
              id="edit-costing-client"
              name="clientId"
              required
              defaultValue={quotation.clientId}
              aria-invalid={Boolean(fieldErrors.clientId)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select client</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
            {fieldErrors.clientId ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.clientId}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-subject">Subject</Label>
            <Input
              id="edit-costing-subject"
              name="subject"
              required
              defaultValue={quotation.subject}
              aria-invalid={Boolean(fieldErrors.subject)}
              className="mt-1"
            />
            {fieldErrors.subject ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.subject}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="edit-costing-amount">Amount</Label>
            <Input
              id="edit-costing-amount"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              defaultValue={quotation.amount}
              aria-invalid={Boolean(fieldErrors.amount)}
              className="mt-1"
            />
            {fieldErrors.amount ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.amount}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="edit-costing-cost">Cost</Label>
            <Input
              id="edit-costing-cost"
              name="cost"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={quotation.cost ?? ""}
              aria-invalid={Boolean(fieldErrors.cost)}
              className="mt-1"
            />
            {fieldErrors.cost ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.cost}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-drive">Google Drive Link</Label>
            <Input
              id="edit-costing-drive"
              name="googleDriveLink"
              type="url"
              required
              defaultValue={quotation.googleDriveLink ?? ""}
              aria-invalid={Boolean(fieldErrors.googleDriveLink)}
              className="mt-1"
            />
            {fieldErrors.googleDriveLink ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.googleDriveLink}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-notes">Notes (optional)</Label>
            <Input
              id="edit-costing-notes"
              name="notes"
              defaultValue={quotation.notes ?? ""}
              className="mt-1"
            />
          </div>

          {formError ? (
            <p className="md:col-span-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
