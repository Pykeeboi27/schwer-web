"use client";

import { updateCostingQuotationAction } from "@/app/protected/engineering/quotations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Callout, textareaClassName } from "@/components/patterns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { suggestQuotationNumber } from "@/lib/engineering/suggest-quotation-number";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type SalesPersonOption = {
  id: string;
  name: string;
};

type EditCostingQuotationDialogProps = {
  open: boolean;
  quotation: CostingQuotation | null;
  clients: ClientOption[];
  salesPeople: SalesPersonOption[];
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
  salesPeople,
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
  }, [open, quotation?.quotationNumber]);

  if (!quotation) {
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Costing Quotation</DialogTitle>
        </DialogHeader>

        {quotation.costingRejectionReason ? (
          <Callout tone="destructive" title="Rejected by executive">
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
            <Select name="clientId" required defaultValue={quotation.clientId}>
              <SelectTrigger
                id="edit-costing-client"
                className="mt-1"
                aria-invalid={Boolean(fieldErrors.clientId)}
              >
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {activeClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.clientId ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.clientId}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="edit-costing-sales-person">Sales Person</Label>
            <Select
              name="salesPersonId"
              defaultValue={quotation.salesPersonId ?? undefined}
            >
              <SelectTrigger id="edit-costing-sales-person" className="mt-1">
                <SelectValue placeholder="Select sales person" />
              </SelectTrigger>
              <SelectContent>
                {salesPeople.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Can be left blank in a draft, but is required before submitting for
              approval.
            </p>
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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
