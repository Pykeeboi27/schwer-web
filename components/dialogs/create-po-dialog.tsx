"use client";

import { createPurchaseOrderAction } from "@/app/protected/sales/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validatePoTotalAmount } from "@/lib/utils/form-validation";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type CreatePoDialogProps = {
  clients: ClientOption[];
};

type CreatePoFieldErrors = {
  clientId?: string;
  subject?: string;
  totalAmount?: string;
  paymentTermsDays?: string;
};

export function CreatePoDialog({ clients }: CreatePoDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CreatePoFieldErrors>({});

  const handleClose = () => {
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
        setOpen(false);
        setIsSubmitting(false);
        setFormError(null);
        setFieldErrors({});
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

    const nextErrors: CreatePoFieldErrors = {};
    const clientId = String(formData.get("clientId") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const paymentTermsDays = String(formData.get("paymentTermsDays") ?? "").trim();

    if (!clientId) {
      nextErrors.clientId = "Client is required.";
    }

    if (!subject) {
      nextErrors.subject = "Subject is required.";
    }

    const totalAmountError = validatePoTotalAmount(formData.get("totalAmount"));
    if (totalAmountError) {
      nextErrors.totalAmount = totalAmountError;
    }

    if (!paymentTermsDays) {
      nextErrors.paymentTermsDays = "Payment terms are required.";
    } else {
      const parsedNetDays = Number(paymentTermsDays);
      if (!Number.isInteger(parsedNetDays) || parsedNetDays < 0) {
        nextErrors.paymentTermsDays =
          "Payment terms must be a whole number of days (0 or greater).";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      const summary = "Please correct the highlighted fields.";
      setFieldErrors(nextErrors);
      setFormError(summary);
      error(summary);
      return;
    }

    setIsSubmitting(true);
    const response = await createPurchaseOrderAction(formData);

    if (!response.success) {
      const message = response.error ?? "Failed to create purchase order.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    success(`Purchase order ${response.data?.poNumber ?? ""} created successfully.`);
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Create Purchase Order
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-po-title"
            className="w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="create-po-title" className="text-xl font-semibold">
                  Create Purchase Order
                </h2>
                <p className="text-sm text-muted-foreground">
                  Capture PO details and initialize collection tracking.
                </p>
              </div>
              <Button variant="ghost" onClick={handleClose} aria-label="Close create purchase order dialog">
                Close
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="po-client">Client</Label>
                <select
                  id="po-client"
                  name="clientId"
                  required
                  aria-invalid={Boolean(fieldErrors.clientId)}
                  aria-describedby={fieldErrors.clientId ? "po-client-error" : undefined}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select client</option>
                  {clients
                    .filter((client) => client.isActive)
                    .map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.companyName}
                      </option>
                    ))}
                </select>
                {fieldErrors.clientId ? (
                  <p id="po-client-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.clientId}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="po-number">PO Number (optional)</Label>
                <Input
                  id="po-number"
                  name="poNumber"
                  className="mt-1"
                  placeholder="Auto-generated if empty"
                />
              </div>

              <div>
                <Label htmlFor="po-status">Status</Label>
                <select
                  id="po-status"
                  name="status"
                  defaultValue="active"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="po-subject">Subject</Label>
                <Input
                  id="po-subject"
                  name="subject"
                  required
                  aria-invalid={Boolean(fieldErrors.subject)}
                  aria-describedby={fieldErrors.subject ? "po-subject-error" : undefined}
                  className="mt-1"
                  placeholder="Project package description"
                />
                {fieldErrors.subject ? (
                  <p id="po-subject-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.subject}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="po-total">Total Amount</Label>
                <Input
                  id="po-total"
                  name="totalAmount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  aria-invalid={Boolean(fieldErrors.totalAmount)}
                  aria-describedby={fieldErrors.totalAmount ? "po-total-error" : undefined}
                  className="mt-1"
                  placeholder="0.00"
                />
                {fieldErrors.totalAmount ? (
                  <p id="po-total-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.totalAmount}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="po-payment-terms">Payment Terms (days)</Label>
                <Input
                  id="po-payment-terms"
                  name="paymentTermsDays"
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={30}
                  aria-invalid={Boolean(fieldErrors.paymentTermsDays)}
                  aria-describedby={fieldErrors.paymentTermsDays ? "po-payment-terms-error" : undefined}
                  className="mt-1"
                />
                {fieldErrors.paymentTermsDays ? (
                  <p id="po-payment-terms-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.paymentTermsDays}
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="po-notes">Notes (optional)</Label>
                <Input
                  id="po-notes"
                  name="notes"
                  className="mt-1"
                  placeholder="Additional payment or delivery notes"
                />
              </div>

              {formError ? (
                <p id="create-po-form-error" role="alert" className="md:col-span-2 text-sm text-destructive">
                  {formError}
                </p>
              ) : null}

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Create PO"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}