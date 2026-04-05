"use client";

import { createQuotationDraftAction } from "@/app/protected/sales/quotations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type CreateQuotationDialogProps = {
  clients: ClientOption[];
};

type CreateQuotationFieldErrors = {
  clientId?: string;
  subject?: string;
  amount?: string;
  cost?: string;
};

export function CreateQuotationDialog({ clients }: CreateQuotationDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CreateQuotationFieldErrors>({});

  const activeClients = useMemo(
    () => clients.filter((client) => client.isActive),
    [clients],
  );

  const dialogTitleId = useMemo(() => "create-quotation-dialog-title", []);

  const closeDialog = () => {
    setOpen(false);
    setIsSubmitting(false);
    setFormError(null);
    setFieldErrors({});
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const nextErrors: CreateQuotationFieldErrors = {};

    const clientId = String(formData.get("clientId") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const amountText = String(formData.get("amount") ?? "").trim();
    const costText = String(formData.get("cost") ?? "").trim();

    if (!clientId) {
      nextErrors.clientId = "Client is required.";
    }

    if (!subject) {
      nextErrors.subject = "Subject is required.";
    }

    const amount = Number(amountText);
    if (!amountText || !Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = "Amount must be greater than 0.";
    }

    if (costText) {
      const cost = Number(costText);
      if (!Number.isFinite(cost) || cost < 0) {
        nextErrors.cost = "Cost must be 0 or greater.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      const message = "Please correct the highlighted fields.";
      setFieldErrors(nextErrors);
      setFormError(message);
      error(message);
      return;
    }

    setIsSubmitting(true);
    const response = await createQuotationDraftAction(formData);

    if (!response.success) {
      const message = response.error ?? "Failed to create quotation draft.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    success("Quotation draft created successfully.");
    closeDialog();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        disabled={activeClients.length === 0}
      >
        Create Quotation
      </Button>

      {open ? (
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
                  Create Quotation
                </h2>
                <p className="text-sm text-muted-foreground">
                  Create a draft quotation for submission and approval.
                </p>
              </div>
              <Button variant="ghost" onClick={closeDialog} aria-label="Close create quotation dialog">
                Close
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="quotation-client">Client</Label>
                <select
                  id="quotation-client"
                  name="clientId"
                  required
                  aria-invalid={Boolean(fieldErrors.clientId)}
                  aria-describedby={fieldErrors.clientId ? "quotation-client-error" : undefined}
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
                  <p id="quotation-client-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.clientId}
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="quotation-subject">Subject</Label>
                <Input
                  id="quotation-subject"
                  name="subject"
                  required
                  aria-invalid={Boolean(fieldErrors.subject)}
                  aria-describedby={fieldErrors.subject ? "quotation-subject-error" : undefined}
                  className="mt-1"
                  placeholder="Project scope or package"
                />
                {fieldErrors.subject ? (
                  <p id="quotation-subject-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.subject}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="quotation-amount">Amount</Label>
                <Input
                  id="quotation-amount"
                  name="amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  aria-invalid={Boolean(fieldErrors.amount)}
                  aria-describedby={fieldErrors.amount ? "quotation-amount-error" : undefined}
                  className="mt-1"
                  placeholder="0.00"
                />
                {fieldErrors.amount ? (
                  <p id="quotation-amount-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.amount}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="quotation-cost">Cost (optional)</Label>
                <Input
                  id="quotation-cost"
                  name="cost"
                  type="number"
                  min={0}
                  step="0.01"
                  aria-invalid={Boolean(fieldErrors.cost)}
                  aria-describedby={fieldErrors.cost ? "quotation-cost-error" : undefined}
                  className="mt-1"
                  placeholder="0.00"
                />
                {fieldErrors.cost ? (
                  <p id="quotation-cost-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.cost}
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="quotation-notes">Notes (optional)</Label>
                <Input
                  id="quotation-notes"
                  name="notes"
                  className="mt-1"
                  placeholder="Additional commercial notes"
                />
              </div>

              {formError ? (
                <p className="md:col-span-2 text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Create Draft"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
