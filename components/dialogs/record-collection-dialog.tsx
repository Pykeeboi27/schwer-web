"use client";

import { recordCollectionAction } from "@/app/protected/sales/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { validateCollectionAmount } from "@/lib/utils/form-validation";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

  const resetState = () => {
    setAmount("");
    setAmountError(null);
    setFormError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

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

  if (!purchaseOrder) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Collection</DialogTitle>
          <DialogDescription>
            Add a payment against this purchase order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p>
            Total Amount: <strong>{formatCurrency(purchaseOrder.poAmount)}</strong>
          </p>
          <p>
            Collected Amount:{" "}
            <strong>{formatCurrency(purchaseOrder.recognizedAmount)}</strong>
          </p>
          <p>
            Remaining Balance: <strong>{formatCurrency(remainingBalance)}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="collection-amount" className="text-sm font-medium">
              Collection Amount
            </label>
            <Input
              id="collection-amount"
              type="number"
              min={0.01}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const nextAmount = event.target.value;
                setAmount(nextAmount);
                if (amountError || formError) {
                  const nextError = validateCollectionAmount(
                    nextAmount,
                    remainingBalance,
                  );
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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Record Collection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
