"use client";

import { updateCostingQuotationAction } from "@/app/protected/engineering/quotations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Callout, fieldClassName, textareaClassName } from "@/components/patterns";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { suggestQuotationNumber } from "@/lib/engineering/suggest-quotation-number";
import { useToast } from "@/lib/utils/toast-notification";
import { cn } from "@/lib/utils";
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
  quotationNumber?: string;
  clientId?: string;
  subject?: string;
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
  const [quotationNumber, setQuotationNumber] = useState(
    quotation?.quotationNumber ?? "",
  );

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
    setQuotationNumber(quotation?.quotationNumber ?? "");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, quotation?.quotationNumber]);

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
    const quotationNumberValue = quotationNumber.trim().toUpperCase();
    if (!quotationNumberValue) nextErrors.quotationNumber = "Quotation ID is required.";
    else formData.set("quotationNumber", quotationNumberValue);

    const clientId = String(formData.get("clientId") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const costText = String(formData.get("cost") ?? "").trim();
    const driveLink = String(formData.get("googleDriveLink") ?? "").trim();

    if (!clientId) nextErrors.clientId = "Client is required.";
    if (!subject) nextErrors.subject = "Subject is required.";

    const cost = Number(costText);
    if (!costText || !Number.isFinite(cost) || cost < 0) {
      nextErrors.cost = "Direct cost must be 0 or greater.";
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
          </div>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
          >
            Close
          </Button>
        </div>

        {quotation.costingRejectionReason ? (
          <Callout tone="destructive" title="Rejected by executive" className="mb-4">
            <p className="text-foreground">{quotation.costingRejectionReason}</p>
          </Callout>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-quotation-number">Quotation ID</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="edit-costing-quotation-number"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value.toUpperCase())}
                aria-invalid={Boolean(fieldErrors.quotationNumber)}
                className="uppercase"
                placeholder="QT-2026-001"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuotationNumber(suggestQuotationNumber())}
              >
                Suggest
              </Button>
            </div>
            {fieldErrors.quotationNumber ? (
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.quotationNumber}
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-client">Client</Label>
            <select
              id="edit-costing-client"
              name="clientId"
              required
              defaultValue={quotation.clientId}
              aria-invalid={Boolean(fieldErrors.clientId)}
              className={cn(fieldClassName, "mt-1 h-9 py-1")}
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

          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-cost">Direct Cost</Label>
            <NumberInput
              id="edit-costing-cost"
              name="cost"
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
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.googleDriveLink}
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-notes">Comments</Label>
            <textarea
              id="edit-costing-notes"
              name="notes"
              rows={3}
              defaultValue={quotation.notes ?? ""}
              className={textareaClassName}
              placeholder="Add any commercial notes or comments (optional)"
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
