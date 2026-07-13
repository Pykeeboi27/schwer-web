"use client";

import { createCostingQuotationAction } from "@/app/protected/engineering/quotations/actions";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { selectFieldClassName, textareaClassName } from "@/components/patterns";
import { suggestQuotationNumber } from "@/lib/engineering/suggest-quotation-number";
import { useToast } from "@/lib/utils/toast-notification";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type CreateCostingQuotationDialogProps = {
  clients: ClientOption[];
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

export function CreateCostingQuotationDialog({
  clients,
}: CreateCostingQuotationDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [quotationNumber, setQuotationNumber] = useState("");

  const activeClients = useMemo(
    () => clients.filter((client) => client.isActive),
    [clients],
  );

  const closeDialog = () => {
    setOpen(false);
    setIsSubmitting(false);
    setFormError(null);
    setFieldErrors({});
    setQuotationNumber("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
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
    const response = await createCostingQuotationAction(formData);

    if (!response.success) {
      const message = response.error ?? "Failed to create costing quotation.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    success("Costing quotation created.");
    closeDialog();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else closeDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" disabled={activeClients.length === 0}>
          Start Costing Quotation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Costing Quotation</DialogTitle>
          <DialogDescription>
            Set the cost and attach a Google Drive link before submitting for executive
            approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="costing-quotation-number">Quotation ID</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="costing-quotation-number"
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
            <Label htmlFor="costing-client">Client</Label>
            <select
              id="costing-client"
              name="clientId"
              required
              aria-invalid={Boolean(fieldErrors.clientId)}
              className={cn(selectFieldClassName, "mt-1 h-9 py-1")}
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
            <Label htmlFor="costing-subject">Subject</Label>
            <Input
              id="costing-subject"
              name="subject"
              required
              aria-invalid={Boolean(fieldErrors.subject)}
              className="mt-1"
              placeholder="Project scope or package"
            />
            {fieldErrors.subject ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.subject}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="costing-cost">Direct Cost</Label>
            <NumberInput
              id="costing-cost"
              name="cost"
              required
              aria-invalid={Boolean(fieldErrors.cost)}
              className="mt-1"
              placeholder="0.00"
            />
            {fieldErrors.cost ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.cost}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="costing-drive">Google Drive Link</Label>
            <Input
              id="costing-drive"
              name="googleDriveLink"
              type="url"
              required
              aria-invalid={Boolean(fieldErrors.googleDriveLink)}
              className="mt-1"
              placeholder="https://drive.google.com/..."
            />
            {fieldErrors.googleDriveLink ? (
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.googleDriveLink}
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="costing-notes">Comments</Label>
            <textarea
              id="costing-notes"
              name="notes"
              rows={3}
              className={textareaClassName}
              placeholder="Add any commercial notes or comments (optional)"
            />
          </div>

          {formError ? (
            <p className="md:col-span-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Create Draft"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
