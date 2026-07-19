"use client";

import {
  deleteCostingQuotationAction,
  submitCostingForApprovalAction,
} from "@/app/protected/engineering/quotations/actions";
import { EditCostingQuotationDialog } from "@/components/dialogs/edit-costing-quotation-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Callout, StatusBadge } from "@/components/patterns";
import type { CostingQuotation } from "@/lib/engineering/costing-quotations";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
  isActive: boolean;
};

type SalesPersonOption = {
  id: string;
  name: string;
};

type CostingQuotationDetailsDialogProps = {
  open: boolean;
  quotation: CostingQuotation | null;
  clients: ClientOption[];
  salesPeople: SalesPersonOption[];
  onOpenChange: (open: boolean) => void;
};

/** Resolve a costing quotation to a shared StatusBadge key. */
function costingBadgeStatus(q: CostingQuotation): string {
  if (q.status === "draft" && q.costingRejectionReason) {
    return "returned";
  }
  return q.status;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CostingQuotationDetailsDialog({
  open,
  quotation,
  clients,
  salesPeople,
  onOpenChange,
}: CostingQuotationDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (!quotation) {
    return null;
  }

  // Any active engineering user can cost/submit a draft RFQ, regardless of
  // who raised it (Sales is the preparer, not Engineering) — matches the
  // eng_quotations_eng_all RLS policy, which grants the whole department
  // access rather than just the row's creator.
  const isEditable = quotation.status === "draft";
  const isPending = quotation.status === "pending";

  const handleSubmit = async () => {
    setIsBusy(true);
    const response = await submitCostingForApprovalAction(quotation.id);
    if (!response.success) {
      error(response.error ?? "Failed to submit for costing approval.");
      setIsBusy(false);
      return;
    }
    success(`Submitted ${quotation.quotationNumber} for costing approval.`);
    setIsBusy(false);
    onOpenChange(false);
    router.refresh();
  };

  const handleDelete = async () => {
    setIsBusy(true);
    const response = await deleteCostingQuotationAction(quotation.id);
    if (!response.success) {
      error(response.error ?? "Failed to delete quotation.");
      setIsBusy(false);
      return;
    }
    success(`Deleted ${quotation.quotationNumber}.`);
    setIsBusy(false);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <>
      <Dialog
        open={open && !isEditing}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{quotation.quotationNumber}</span>
              <StatusBadge status={costingBadgeStatus(quotation)} />
            </DialogTitle>
          </DialogHeader>

          {quotation.costingRejectionReason ? (
            <Callout tone="destructive" title="Returned by executive">
              <p className="text-foreground">{quotation.costingRejectionReason}</p>
            </Callout>
          ) : null}

          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd className="font-medium">{quotation.clientName}</dd>

            <dt className="text-muted-foreground">Subject</dt>
            <dd className="font-medium">{quotation.subject}</dd>

            <dt className="text-muted-foreground">Sales Person</dt>
            <dd className="font-medium">
              {quotation.salesPersonName ?? (
                <span className="text-muted-foreground">Not assigned</span>
              )}
            </dd>

            <dt className="text-muted-foreground">Google Drive</dt>
            <dd className="font-medium">
              {quotation.googleDriveLink ? (
                <a
                  href={quotation.googleDriveLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </dd>

            <dt className="text-muted-foreground">Notes</dt>
            <dd className="font-medium">
              {quotation.notes ?? <span className="text-muted-foreground">-</span>}
            </dd>

            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatDate(quotation.createdAt)}</dd>
          </dl>

          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">Line Items</p>
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Item</th>
                  <th className="py-1 pr-3 font-medium">Qty</th>
                  <th className="py-1 pr-3 font-medium">Unit Cost</th>
                  <th className="py-1 font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="py-1 pr-3">{item.description}</td>
                    <td className="py-1 pr-3">{item.quantity}</td>
                    <td className="py-1 pr-3">
                      {item.unitCost === null ? (
                        <span className="text-muted-foreground">Not costed yet</span>
                      ) : (
                        formatCurrency(item.unitCost)
                      )}
                    </td>
                    <td className="py-1">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="py-1 pr-3" colSpan={3}>
                    Total Cost
                  </td>
                  <td className="py-1">{formatCurrency(quotation.cost)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            {isPending ? (
              <span className="text-sm text-muted-foreground">
                Awaiting executive review.
              </span>
            ) : !isEditable ? (
              <span className="text-sm text-muted-foreground">View only.</span>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isBusy}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  disabled={isBusy}
                >
                  Edit
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={isBusy}>
                  {isBusy ? "Saving..." : "Submit for Approval"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditCostingQuotationDialog
        open={isEditing}
        quotation={quotation}
        clients={clients}
        salesPeople={salesPeople}
        onOpenChange={(next) => {
          setIsEditing(next);
          if (!next) onOpenChange(false);
        }}
      />
    </>
  );
}
