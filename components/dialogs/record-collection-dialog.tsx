"use client";

import {
  createProofOfPaymentSignedUrlAction,
  recordCollectionAction,
  updateCollectionAction,
} from "@/app/protected/sales/purchase-orders/actions";
import { ProofOfPaymentField } from "@/components/dialogs/proof-of-payment-field";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildProofOfPaymentPath, PROOF_OF_PAYMENT_BUCKET } from "@/lib/sales/proof-of-payment";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { createClient } from "@/lib/supabase/client";
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
  /** Current signed-in user's id -- used to scope the proof's storage path. */
  userId: string;
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
  userId,
  mode = "record",
  payment = null,
}: RecordCollectionDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [existingProofPreviewUrl, setExistingProofPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
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
    setProofFile(null);
    setExistingProofPreviewUrl(null);
    setAmountError(null);
    setProofError(null);
    setFormError(null);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    setAmount(isEdit && payment ? String(payment.amountCollected) : "");
    setProofFile(null);
    setAmountError(null);
    setProofError(null);
    setFormError(null);

    // Load a preview of the existing proof when editing a payment that has one.
    let cancelled = false;
    setExistingProofPreviewUrl(null);
    if (isEdit && payment?.proofPath) {
      void createProofOfPaymentSignedUrlAction(payment.proofPath).then((response) => {
        if (!cancelled && response.success && response.data) {
          setExistingProofPreviewUrl(response.data.url);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, payment]);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setAmountError(null);
    setProofError(null);
    setFormError(null);

    const validationError = validateCollectionAmount(amount, remainingBalance);
    // New collections must include a proof photo; edits keep the existing
    // proof unless the user chooses a replacement.
    const missingProof = !isEdit && !proofFile;

    if (validationError || missingProof) {
      const summary = "Please correct the highlighted fields.";
      setAmountError(validationError);
      if (missingProof) {
        setProofError("A proof-of-payment photo is required.");
      }
      setFormError(summary);
      error(validationError ?? "A proof-of-payment photo is required.");
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

    // Upload the compressed proof (if a new/first one was chosen) before
    // touching the collection record itself, so we never write a payment
    // that references a nonexistent object.
    let uploadedPath: string | null = null;
    if (proofFile) {
      const path = buildProofOfPaymentPath(userId, purchaseOrder.id);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(PROOF_OF_PAYMENT_BUCKET)
        .upload(path, proofFile, { contentType: "image/webp" });

      if (uploadError) {
        const message = uploadError.message || "Failed to upload proof of payment.";
        setFormError(message);
        error(message);
        setIsSubmitting(false);
        return;
      }
      uploadedPath = path;
    }

    const previousProofPath = isEdit && payment ? payment.proofPath : null;

    const response =
      isEdit && payment
        ? await updateCollectionAction(
            payment.id,
            purchaseOrder.id,
            parsedAmount,
            uploadedPath ?? undefined,
          )
        : await recordCollectionAction(purchaseOrder.id, parsedAmount, uploadedPath ?? "");

    if (!response.success) {
      // Best-effort cleanup so a failed save doesn't leave an orphaned object.
      if (uploadedPath) {
        const supabase = createClient();
        void supabase.storage.from(PROOF_OF_PAYMENT_BUCKET).remove([uploadedPath]);
      }
      const message =
        response.error ??
        (isEdit ? "Failed to update collection." : "Failed to record collection.");
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    // Replacing an existing proof: remove the old object now that the new
    // path has been saved.
    if (uploadedPath && previousProofPath && previousProofPath !== uploadedPath) {
      const supabase = createClient();
      void supabase.storage.from(PROOF_OF_PAYMENT_BUCKET).remove([previousProofPath]);
    }

    success(
      isEdit ? "Collection updated successfully." : "Collection recorded successfully.",
    );
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
              ? "Update this payment's amount or replace its proof of payment."
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
                  if (!nextError && !proofError) {
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

          <div>
            <ProofOfPaymentField
              id="collection-proof"
              label={isEdit ? "Proof of Payment" : "Proof of Payment (required)"}
              value={proofFile}
              onChange={(file) => {
                setProofFile(file);
                if (proofError) {
                  const stillMissing = !isEdit && !file;
                  setProofError(stillMissing ? "A proof-of-payment photo is required." : null);
                  if (!stillMissing && !amountError) {
                    setFormError(null);
                  }
                }
              }}
              existingPreviewUrl={existingProofPreviewUrl}
              disabled={isSubmitting}
              aria-invalid={Boolean(proofError)}
              aria-describedby={proofError ? "collection-proof-error" : undefined}
              onError={(message) => {
                setProofError(message);
                error(message);
              }}
            />
            {proofError ? (
              <p id="collection-proof-error" className="mt-1 text-xs text-destructive">
                {proofError}
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
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Record Collection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
