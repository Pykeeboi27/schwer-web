"use client";

import { createCostingQuotationAction } from "@/app/protected/engineering/quotations/actions";
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

type CreateCostingQuotationDialogProps = {
  clients: ClientOption[];
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

export function CreateCostingQuotationDialog({ clients }: CreateCostingQuotationDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const activeClients = useMemo(
    () => clients.filter((client) => client.isActive),
    [clients],
  );

  const dialogTitleId = useMemo(() => "create-costing-quotation-dialog-title", []);

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
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
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
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        disabled={activeClients.length === 0}
      >
        Start Costing Quotation
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
                  Start Costing Quotation
                </h2>
                <p className="text-sm text-muted-foreground">
                  Set the cost and attach a Google Drive link before submitting for executive
                  approval.
                </p>
              </div>
              <Button variant="ghost" onClick={closeDialog} aria-label="Close dialog">
                Close
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="costing-client">Client</Label>
                <select
                  id="costing-client"
                  name="clientId"
                  required
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

              <div>
                <Label htmlFor="costing-amount">Amount</Label>
                <Input
                  id="costing-amount"
                  name="amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  aria-invalid={Boolean(fieldErrors.amount)}
                  className="mt-1"
                  placeholder="0.00"
                />
                {fieldErrors.amount ? (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.amount}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="costing-cost">Cost</Label>
                <Input
                  id="costing-cost"
                  name="cost"
                  type="number"
                  min={0}
                  step="0.01"
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
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.googleDriveLink}</p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="costing-notes">Notes (optional)</Label>
                <Input
                  id="costing-notes"
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
