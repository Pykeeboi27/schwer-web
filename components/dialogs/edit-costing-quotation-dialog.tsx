"use client";

import { setQuotationItemCostsAction } from "@/app/protected/engineering/quotations/actions";
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
import { formatCurrency } from "@/lib/utils/number-format";
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
  const [clientId, setClientId] = useState(quotation?.clientId ?? "");
  const [salesPersonId, setSalesPersonId] = useState(quotation?.salesPersonId ?? "");
  const [subject, setSubject] = useState(quotation?.subject ?? "");
  const [googleDriveLink, setGoogleDriveLink] = useState(
    quotation?.googleDriveLink ?? "",
  );
  const [notes, setNotes] = useState(quotation?.notes ?? "");
  const [itemCosts, setItemCosts] = useState<Record<string, string>>({});

  const activeClients = useMemo(
    () => clients.filter((c) => c.isActive || c.id === quotation?.clientId),
    [clients, quotation],
  );

  const totalCost = useMemo(() => {
    if (!quotation) return 0;
    return quotation.items.reduce((sum, item) => {
      const unitCost = Number(itemCosts[item.id]);
      return sum + (Number.isFinite(unitCost) ? unitCost * item.quantity : 0);
    }, 0);
  }, [quotation, itemCosts]);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setFormError(null);
      setFieldErrors({});
      return;
    }
    setQuotationNumber(quotation?.quotationNumber ?? "");
    setClientId(quotation?.clientId ?? "");
    setSalesPersonId(quotation?.salesPersonId ?? "");
    setSubject(quotation?.subject ?? "");
    setGoogleDriveLink(quotation?.googleDriveLink ?? "");
    setNotes(quotation?.notes ?? "");
    setItemCosts(
      Object.fromEntries(
        (quotation?.items ?? []).map((item) => [
          item.id,
          item.unitCost === null ? "" : String(item.unitCost),
        ]),
      ),
    );
  }, [open, quotation]);

  if (!quotation) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const nextErrors: FieldErrors = {};
    const quotationNumberValue = quotationNumber.trim().toUpperCase();
    if (!quotationNumberValue) nextErrors.quotationNumber = "Quotation ID is required.";

    if (!clientId) nextErrors.clientId = "Client is required.";
    if (!subject.trim()) nextErrors.subject = "Subject is required.";

    const driveLink = googleDriveLink.trim();
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
    const response = await setQuotationItemCostsAction({
      quotationId: quotation.id,
      quotationNumber: quotationNumberValue,
      clientId,
      // Quotation subject and comments are standardized to ALL CAPS.
      subject: subject.trim().toUpperCase(),
      items: quotation.items.map((item) => ({
        id: item.id,
        unitCost: itemCosts[item.id] ?? "",
      })),
      googleDriveLink: driveLink,
      notes: notes.trim() ? notes.trim().toUpperCase() : null,
      salesPersonId: salesPersonId || null,
    });

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
          <DialogTitle>Set Direct Costs</DialogTitle>
        </DialogHeader>

        {quotation.costingRejectionReason ? (
          <Callout tone="destructive" title="Rejected by executive">
            <p className="text-foreground">{quotation.costingRejectionReason}</p>
          </Callout>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Select value={clientId} onValueChange={setClientId}>
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
              <Select value={salesPersonId} onValueChange={setSalesPersonId}>
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
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="edit-costing-subject">Subject</Label>
              <Input
                id="edit-costing-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-invalid={Boolean(fieldErrors.subject)}
                className="mt-1"
              />
              {fieldErrors.subject ? (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.subject}</p>
              ) : null}
            </div>
          </div>

          <div>
            <Label>Line Item Direct Costs</Label>
            <div className="mt-2 space-y-2 rounded-md border p-3">
              {quotation.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                  </div>
                  <NumberInput
                    value={itemCosts[item.id] ?? ""}
                    onValueChange={(raw) =>
                      setItemCosts((prev) => ({ ...prev, [item.id]: raw }))
                    }
                    placeholder="Unit Direct Cost"
                    className="w-36"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total Direct Cost</span>
                <span>{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="edit-costing-drive">Google Drive Link</Label>
            <Input
              id="edit-costing-drive"
              value={googleDriveLink}
              onChange={(e) => setGoogleDriveLink(e.target.value)}
              type="url"
              aria-invalid={Boolean(fieldErrors.googleDriveLink)}
              className="mt-1"
            />
            {fieldErrors.googleDriveLink ? (
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.googleDriveLink}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="edit-costing-notes">Comments</Label>
            <textarea
              id="edit-costing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={textareaClassName}
              placeholder="Add any commercial notes or comments (optional)"
            />
          </div>

          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
