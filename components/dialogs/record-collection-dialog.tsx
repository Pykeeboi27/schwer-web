"use client";

import {
  recordCollectionAction,
  updateCollectionAction,
} from "@/app/protected/sales/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { cn } from "@/lib/utils";
import { validateCollectionAmount } from "@/lib/utils/form-validation";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CollectionDialogMode = "record" | "edit";

type RecordCollectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: SalesPurchaseOrder | null;
  mode?: CollectionDialogMode;
  payment?: SalesPoPayment | null;
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
  mode = "record",
  payment = null,
}: RecordCollectionDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = mode === "edit" && Boolean(payment);

  const remainingBalance = useMemo(() => {
    if (!purchaseOrder) {
      return 0;
    }

    const recognizedExcludingCurrent =
      isEdit && payment
        ? purchaseOrder.recognizedAmount - payment.amountCollected
        : purchaseOrder.recognizedAmount;

    return Math.max(purchaseOrder.poAmount - recognizedExcludingCurrent, 0);
  }, [purchaseOrder, isEdit, payment]);

  const resetState = () => {
    setAmount("");
    setAmountError(null);
    setFormError(null);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    setAmount(isEdit && payment ? String(payment.amountCollected) : "");
    setAmountError(null);
    setFormError(null);
  }, [open, isEdit, payment]);

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

    if (isEdit && !payment) {
      const message = "Collection record not found.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    const response =
      isEdit && payment
        ? await updateCollectionAction(payment.id, purchaseOrder.id, parsedAmount)
        : await recordCollectionAction(purchaseOrder.id, parsedAmount);

    if (!response.success) {
      const message =
        response.error ?? (isEdit ? "Failed to update collection." : "Failed to record collection.");
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    success(isEdit ? "Collection updated successfully." : "Collection recorded successfully.");
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
      <DialogContent
        className={cn(
          "max-h-[85vh] overflow-y-auto",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
        )}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Collection" : "Record Collection"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this payment's amount."
              : "Add a payment against this purchase order."}
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
            <NumberInput
              id="collection-amount"
              value={amount}
              onValueChange={(nextAmount) => {
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
              {isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Record Collection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
