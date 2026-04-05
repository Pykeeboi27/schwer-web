"use client";

import { recordCollectionAction } from "@/app/protected/sales/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { validateCollectionAmount } from "@/lib/utils/form-validation";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type RecordCollectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: SalesPurchaseOrder | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function RecordCollectionDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: RecordCollectionDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const remainingBalance = useMemo(() => {
    if (!purchaseOrder) {
      return 0;
    }

    return Math.max(purchaseOrder.poAmount - purchaseOrder.recognizedAmount, 0);
  }, [purchaseOrder]);

  const handleClose = () => {
    setAmount("");
    setAmountError(null);
    setFormError(null);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAmount("");
        setAmountError(null);
        setFormError(null);
        setIsSubmitting(false);
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setAmountError(null);
    setFormError(null);

    const validationError = validateCollectionAmount(amount, remainingBalance);
    if (validationError) {
      const summary = "Please correct the highlighted fields.";
      setAmountError(validationError);
      setFormError(summary);
      error(validationError);
      return;
    }

    const parsedAmount = Number(amount);
    setIsSubmitting(true);

    if (!purchaseOrder) {
      const message = "Purchase order not found.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    const response = await recordCollectionAction(purchaseOrder.id, parsedAmount);
    if (!response.success) {
      const message = response.error ?? "Failed to record collection.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    success("Collection recorded successfully.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  if (!open || !purchaseOrder) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-collection-title"
        className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="record-collection-title" className="text-xl font-semibold">
              Record Collection
            </h2>
            <p className="text-sm text-muted-foreground">
              Add a payment against this purchase order.
            </p>
          </div>
          <Button variant="ghost" onClick={handleClose} aria-label="Close record collection dialog">
            Close
          </Button>
        </div>

        <div className="space-y-2 rounded border p-3 text-sm">
          <p>
            Total Amount: <strong>{formatCurrency(purchaseOrder.poAmount)}</strong>
          </p>
          <p>
            Collected Amount: <strong>{formatCurrency(purchaseOrder.recognizedAmount)}</strong>
          </p>
          <p>
            Remaining Balance: <strong>{formatCurrency(remainingBalance)}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="collection-amount" className="text-sm font-medium">
              Collection Amount
            </label>
            <Input
              id="collection-amount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(event) => {
                const nextAmount = event.target.value;
                setAmount(nextAmount);
                if (amountError || formError) {
                  const nextError = validateCollectionAmount(nextAmount, remainingBalance);
                  setAmountError(nextError);
                  if (!nextError) {
                    setFormError(null);
                  }
                }
              }}
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? "collection-amount-error" : undefined}
              className="mt-1"
              placeholder="0.00"
            />
            {amountError ? (
              <p id="collection-amount-error" className="mt-1 text-xs text-destructive">
                {amountError}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Record Collection"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}