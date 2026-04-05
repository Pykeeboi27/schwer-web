"use client";

import { RecordCollectionDialog } from "@/components/dialogs/record-collection-dialog";
import { Button } from "@/components/ui/button";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { useEffect, useMemo, useState } from "react";

type PurchaseOrderDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: SalesPurchaseOrder | null;
  payments: SalesPoPayment[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PurchaseOrderDetailsDialog({
  open,
  onOpenChange,
  purchaseOrder,
  payments,
}: PurchaseOrderDetailsDialogProps) {
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  const paymentHistory = useMemo(() => {
    if (!purchaseOrder) {
      return [];
    }

    return payments.filter((payment) => payment.poId === purchaseOrder.id);
  }, [payments, purchaseOrder]);

  const handleClose = () => {
    setRecordDialogOpen(false);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRecordDialogOpen(false);
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || !purchaseOrder) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-order-details-title"
          className="w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lg"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="purchase-order-details-title" className="text-xl font-semibold">
                Purchase Order Details
              </h2>
              <p className="text-sm text-muted-foreground">
                Review PO values and collection history.
              </p>
            </div>
            <Button variant="ghost" onClick={handleClose} aria-label="Close purchase order details dialog">
              Close
            </Button>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">PO Number</dt>
              <dd className="font-medium">{purchaseOrder.poNumber}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Client</dt>
              <dd>{purchaseOrder.clientName}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Subject</dt>
              <dd>{purchaseOrder.subject}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Total Amount</dt>
              <dd>{formatCurrency(purchaseOrder.poAmount)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Collected Amount</dt>
              <dd>{formatCurrency(purchaseOrder.recognizedAmount)}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{purchaseOrder.paymentStatus}</dd>
            </div>
          </dl>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold">Collection History</h3>
              <Button type="button" onClick={() => setRecordDialogOpen(true)}>
                Record Collection
              </Button>
            </div>

            <div className="max-h-64 space-y-2 overflow-auto rounded border p-3">
              {paymentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No collections recorded yet.</p>
              ) : (
                paymentHistory.map((payment) => (
                  <div key={payment.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">{formatCurrency(payment.amountCollected)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.paymentDate).toLocaleDateString()}
                      {payment.paymentMethod ? ` • ${payment.paymentMethod}` : ""}
                      {payment.referenceNumber ? ` • ${payment.referenceNumber}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <RecordCollectionDialog
        open={recordDialogOpen}
        purchaseOrder={purchaseOrder}
        onOpenChange={setRecordDialogOpen}
      />
    </>
  );
}