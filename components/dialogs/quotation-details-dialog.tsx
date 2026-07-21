"use client";

import {
  approveQuotationAction,
  convertToPurchaseOrderAction,
  markClientPoReceivedAction,
  rejectQuotationAction,
  resubmitQuotationAction,
  submitQuotationForApprovalAction,
  updateSalesQuotationDetailsAction,
} from "@/app/protected/sales/quotations/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Callout, StatusBadge, textareaClassName } from "@/components/patterns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeAggregatePricing,
  computeSalesPricing,
  computeVatBreakdown,
} from "@/lib/sales/pricing";
import type {
  SalesQuotation,
  SalesQuotationItemPricingInput,
} from "@/lib/sales/quotations";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type QuotationDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: SalesQuotation | null;
  currentUserId: string;
  currentUserRole: string | null;
};

const PAYMENT_TERMS_OPTIONS = [
  "50% Down Payment, 50% Upon Delivery",
  "15 Days",
  "30 Days",
  "Other",
] as const;

function formatPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
}

function formatLeadTime(days: number | null): string {
  if (days === null) {
    return "—";
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

function computedMarginPercent(amount: number, cost: number | null): string {
  if (cost === null || amount <= 0) {
    return "—";
  }
  const value = ((amount - cost) / amount) * 100;
  return `${value.toFixed(2)}%`;
}

type ItemPricingFields = {
  marginPercentage: string;
  bankPercentage: string;
  sopPercentage: string;
};

const emptyItemPricing: ItemPricingFields = {
  marginPercentage: "",
  bankPercentage: "",
  sopPercentage: "",
};

function statusLabel(status: SalesQuotation["status"]): string {
  if (status === "draft") {
    return "Draft";
  }

  if (status === "pending") {
    return "Pending Approval";
  }

  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  if (status === "closed") {
    return "Closed (Converted to PO)";
  }

  return "Cancelled";
}

export function QuotationDetailsDialog({
  open,
  onOpenChange,
  quotation,
  currentUserId,
  currentUserRole,
}: QuotationDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnequalMargins, setHasUnequalMargins] = useState(false);
  const [itemPricing, setItemPricing] = useState<Record<string, ItemPricingFields>>({});
  const [uniformMarginPercentage, setUniformMarginPercentage] = useState("");
  const [uniformBankPercentage, setUniformBankPercentage] = useState("");
  const [uniformSopPercentage, setUniformSopPercentage] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkMarginPercentage, setBulkMarginPercentage] = useState("");
  const [bulkBankPercentage, setBulkBankPercentage] = useState("");
  const [bulkSopPercentage, setBulkSopPercentage] = useState("");
  const [googleDriveLink, setGoogleDriveLink] = useState("");
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveUploadedName, setDriveUploadedName] = useState<string | null>(null);
  const [driveNotConfigured, setDriveNotConfigured] = useState(false);
  const [paymentTermsSelect, setPaymentTermsSelect] = useState("");
  const [paymentTermsCustom, setPaymentTermsCustom] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");
  const [clientPoNumber, setClientPoNumber] = useState("");

  const normalizedRole = useMemo(
    () =>
      String(currentUserRole ?? "")
        .trim()
        .toLowerCase(),
    [currentUserRole],
  );

  // Only the sales person a quotation is assigned to may edit it; everyone else
  // in the department sees the same details read-only (approvers are exempt —
  // see canApproveReject below, which is role-based, not ownership-based).
  const isOwner = Boolean(quotation && quotation.salesPersonId === currentUserId);

  const isDraft = quotation?.status === "draft";
  const isRejected = quotation?.status === "rejected";
  const isClosed = quotation?.status === "closed";
  const isApproved = quotation?.status === "approved";
  const isConverted = Boolean(quotation?.convertedPoId);
  const isClientConfirmed = Boolean(quotation?.clientConfirmedAt);
  // Approved + client provided their PO + not yet converted -> re-open for editing.
  const isReopenedForPo = isApproved && isClientConfirmed && !isConverted;
  // Approved but client PO not yet recorded -> offer the "client confirmed" step.
  const canEnterClientPo = isApproved && !isClientConfirmed && !isConverted && isOwner;
  const isEditable = (isDraft || isRejected || isReopenedForPo) && isOwner;

  const canApproveReject =
    quotation?.status === "pending" &&
    quotation.pendingApprovalRoles.includes(
      normalizedRole as "sales_manager" | "owner" | "executive",
    );

  const pendingApprovalText =
    quotation && quotation.pendingApprovalRoles.length > 0
      ? quotation.pendingApprovalRoles.join(" -> ")
      : "No pending approvers";

  const handleClose = () => {
    onOpenChange(false);
    setRejectionReason("");
  };

  const handleResubmit = async () => {
    if (!quotation) return;
    setIsSubmitting(true);
    const response = await resubmitQuotationAction(quotation.id);
    if (!response.success) {
      error(response.error ?? "Failed to resubmit quotation.");
      setIsSubmitting(false);
      return;
    }
    success("Quotation resubmitted for approval.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!quotation || !open) {
      return;
    }

    setHasUnequalMargins(quotation.hasUnequalMargins);
    const nextItemPricing: Record<string, ItemPricingFields> = {};
    quotation.items.forEach((item) => {
      nextItemPricing[item.id] = {
        marginPercentage:
          item.marginPercentage === null ? "" : String(item.marginPercentage),
        bankPercentage: item.bankPercentage === null ? "" : String(item.bankPercentage),
        sopPercentage: item.sopPercentage === null ? "" : String(item.sopPercentage),
      };
    });
    setItemPricing(nextItemPricing);
    // The uniform-mode fields mirror the first item's values -- when
    // hasUnequalMargins is false every item is kept equal by
    // applyUniformPercentage, so any item is representative.
    const firstItem = quotation.items[0];
    setUniformMarginPercentage(
      firstItem && firstItem.marginPercentage !== null
        ? String(firstItem.marginPercentage)
        : "",
    );
    setUniformBankPercentage(
      firstItem && firstItem.bankPercentage !== null
        ? String(firstItem.bankPercentage)
        : "",
    );
    setUniformSopPercentage(
      firstItem && firstItem.sopPercentage !== null
        ? String(firstItem.sopPercentage)
        : "",
    );
    setSelectedItemIds(new Set());
    setBulkMarginPercentage("");
    setBulkBankPercentage("");
    setBulkSopPercentage("");
    setGoogleDriveLink(quotation.googleDriveLink ?? "");

    // Map the stored payment terms back onto the dropdown + custom field.
    const storedTerms = quotation.paymentTerms ?? "";
    if (
      storedTerms !== "" &&
      !PAYMENT_TERMS_OPTIONS.includes(
        storedTerms as (typeof PAYMENT_TERMS_OPTIONS)[number],
      )
    ) {
      setPaymentTermsSelect("Other");
      setPaymentTermsCustom(quotation.paymentTermsCustom ?? storedTerms);
    } else if (storedTerms === "Other") {
      setPaymentTermsSelect("Other");
      setPaymentTermsCustom(quotation.paymentTermsCustom ?? "");
    } else {
      setPaymentTermsSelect(storedTerms);
      setPaymentTermsCustom("");
    }

    setLeadTimeDays(
      quotation.leadTimeDays === null ? "" : String(quotation.leadTimeDays),
    );
    setNotes(quotation.notes ?? "");
    setClientPoNumber(quotation.clientPoNumber ?? "");
  }, [quotation, open]);

  if (!quotation) {
    return null;
  }

  // Per-item live pricing preview, derived from itemPricing (the editable
  // state) against each item's own direct cost (line total) -- then rolled
  // into one aggregate for the totals footer and VAT breakdown.
  const pricedItems = quotation.items.map((item) => {
    const row = itemPricing[item.id] ?? emptyItemPricing;
    const itemPricingResult = computeSalesPricing({
      directCost: item.lineTotal,
      marginPercentage: Number(row.marginPercentage) || 0,
      bankPercentage: Number(row.bankPercentage) || 0,
      sopPercentage: Number(row.sopPercentage) || 0,
    });
    return {
      id: item.id,
      description: item.description,
      directCost: item.lineTotal,
      ...row,
      ...itemPricingResult,
    };
  });

  const pricing = computeAggregatePricing(pricedItems);
  // VAT applies once, to the rolled-up aggregate -- not per item -- so
  // pricing.sellingAmount stays pre-VAT and vat.grandTotal is the final amount.
  const vat = computeVatBreakdown(pricing);
  // Read-only summary VAT, derived from the quotation's already-persisted
  // blended amounts (not the live edit-state pricing above).
  const blendedVat = computeVatBreakdown({
    marginAmount: quotation.marginAmount ?? 0,
    bankAmount: quotation.bankAmount ?? 0,
    sopAmount: quotation.sopAmount ?? 0,
    sellingAmount: quotation.sellingAmount ?? quotation.amount,
  });

  const paymentTermsResolved =
    paymentTermsSelect === "Other"
      ? paymentTermsCustom.trim()
      : paymentTermsSelect.trim();

  const salesDetailsComplete =
    quotation.items.every(
      (item) => (itemPricing[item.id]?.marginPercentage ?? "").trim() !== "",
    ) &&
    paymentTermsResolved !== "" &&
    leadTimeDays.trim() !== "";

  /** Unticked mode: writing one field broadcasts it onto every item's pricing. */
  const applyUniformPercentage = (field: keyof ItemPricingFields, value: string) => {
    setItemPricing((prev) => {
      const next = { ...prev };
      for (const item of quotation.items) {
        next[item.id] = { ...(next[item.id] ?? emptyItemPricing), [field]: value };
      }
      return next;
    });
  };

  const updateItemPercentage = (
    itemId: string,
    field: keyof ItemPricingFields,
    value: string,
  ) => {
    setItemPricing((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? emptyItemPricing), [field]: value },
    }));
  };

  const toggleItemSelected = (itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  /** Ticked mode: stamps the bulk %s onto every selected item, once. */
  const applyBulkPercentages = () => {
    if (selectedItemIds.size === 0) {
      error("Select at least one item to apply pricing to.");
      return;
    }

    setItemPricing((prev) => {
      const next = { ...prev };
      for (const itemId of selectedItemIds) {
        next[itemId] = {
          marginPercentage:
            bulkMarginPercentage.trim() !== ""
              ? bulkMarginPercentage
              : (next[itemId]?.marginPercentage ?? ""),
          bankPercentage:
            bulkBankPercentage.trim() !== ""
              ? bulkBankPercentage
              : (next[itemId]?.bankPercentage ?? ""),
          sopPercentage:
            bulkSopPercentage.trim() !== ""
              ? bulkSopPercentage
              : (next[itemId]?.sopPercentage ?? ""),
        };
      }
      return next;
    });
  };

  const handleSaveSalesDetails = async () => {
    const trimmedLeadTime = leadTimeDays.trim();

    const itemsPayload: SalesQuotationItemPricingInput[] = [];
    for (const item of quotation.items) {
      const row = itemPricing[item.id] ?? emptyItemPricing;
      const parsed: Record<keyof ItemPricingFields, number | null> = {
        marginPercentage: null,
        bankPercentage: null,
        sopPercentage: null,
      };
      for (const [field, label] of [
        ["marginPercentage", "Margin"],
        ["bankPercentage", "Bank"],
        ["sopPercentage", "SOP"],
      ] as const) {
        const raw = row[field].trim();
        if (raw !== "") {
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0) {
            error(`${label} percentage for "${item.description}" must be 0 or greater.`);
            return;
          }
          parsed[field] = value;
        }
      }
      itemsPayload.push({ id: item.id, ...parsed });
    }

    if (trimmedLeadTime !== "") {
      const days = Number(trimmedLeadTime);
      if (!Number.isFinite(days) || !Number.isInteger(days) || days < 0) {
        error("Lead time must be a whole number of days (0 or greater).");
        return;
      }
    }

    if (paymentTermsSelect === "Other" && paymentTermsCustom.trim() === "") {
      error("Please enter the custom payment terms.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("quotationId", quotation.id);
    formData.set("hasUnequalMargins", hasUnequalMargins ? "true" : "false");
    formData.set("items", JSON.stringify(itemsPayload));
    formData.set("googleDriveLink", googleDriveLink.trim());
    formData.set("paymentTerms", paymentTermsSelect.trim());
    formData.set("paymentTermsCustom", paymentTermsCustom.trim());
    formData.set("leadTimeDays", trimmedLeadTime);
    // Quotation comments are standardized to ALL CAPS.
    formData.set("notes", notes.trim().toUpperCase());

    const response = await updateSalesQuotationDetailsAction(formData);
    if (!response.success) {
      error(response.error ?? "Failed to update sales details.");
      setIsSubmitting(false);
      return;
    }

    success("Sales details saved.");
    setIsSubmitting(false);
    router.refresh();
  };

  const handleSubmitForApproval = async () => {
    if (!salesDetailsComplete) {
      error("Margin, payment terms, and lead time are required before submitting.");
      return;
    }

    setIsSubmitting(true);

    const response = await submitQuotationForApprovalAction(quotation.id);
    if (!response.success) {
      error(response.error ?? "Failed to submit quotation for approval.");
      setIsSubmitting(false);
      return;
    }

    success("Quotation submitted for approval.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleMarkClientPo = async () => {
    if (clientPoNumber.trim() === "") {
      error("Enter the client's PO number.");
      return;
    }

    setIsSubmitting(true);
    const response = await markClientPoReceivedAction(
      quotation.id,
      clientPoNumber.trim(),
    );
    if (!response.success) {
      error(response.error ?? "Failed to record the client PO.");
      setIsSubmitting(false);
      return;
    }

    success("Client PO recorded. The quotation is re-opened for editing.");
    setIsSubmitting(false);
    router.refresh();
  };

  const handleConvertToPo = async () => {
    setIsSubmitting(true);
    const response = await convertToPurchaseOrderAction(quotation.id);
    if (!response.success) {
      error(response.error ?? "Failed to convert to purchase order.");
      setIsSubmitting(false);
      return;
    }

    success("Converted to a purchase order and sent for approval.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleApprove = async () => {
    setIsSubmitting(true);

    const response = await approveQuotationAction(quotation.id, normalizedRole);
    if (!response.success) {
      error(response.error ?? "Failed to approve quotation.");
      setIsSubmitting(false);
      return;
    }

    success("Quotation approved successfully.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    const normalizedReason = rejectionReason.trim();

    if (!normalizedReason) {
      error("Please provide a rejection reason.");
      return;
    }

    setIsSubmitting(true);

    const response = await rejectQuotationAction(
      quotation.id,
      normalizedReason,
      normalizedRole,
    );
    if (!response.success) {
      error(response.error ?? "Failed to reject quotation.");
      setIsSubmitting(false);
      return;
    }

    success("Quotation rejected.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-2xl overflow-y-auto md:max-w-3xl lg:max-w-4xl",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
        )}
      >
        <DialogHeader>
          <DialogTitle>Quotation Details</DialogTitle>
          <DialogDescription>
            {!isOwner && !canApproveReject
              ? "This quotation belongs to another sales person and is read-only."
              : isDraft
                ? "Add the sales details, then submit for approval."
                : isRejected
                  ? "This quotation was rejected. Update the sales details, then resubmit for approval."
                  : "Review details and process approval actions."}
          </DialogDescription>
        </DialogHeader>

        {isRejected && quotation.rejectionReason ? (
          <Callout
            tone="destructive"
            title={`Rejected by ${quotation.rejectedByName ?? "Unknown"}`}
          >
            <p className="text-foreground">{quotation.rejectionReason}</p>
          </Callout>
        ) : null}

        <dl className="grid gap-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Quotation ID</dt>
            <dd className="font-medium">{quotation.quotationNumber}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{quotation.clientName}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Authored By</dt>
            <dd>{quotation.salesPersonName ?? "Unassigned"}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Subject</dt>
            <dd>{quotation.subject}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Direct Cost</dt>
            <dd>{quotation.cost === null ? "—" : formatCurrency(quotation.cost)}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Grand Total (incl. VAT)</dt>
            <dd>{formatCurrency(quotation.amount)}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Overall Margin</dt>
            <dd>{computedMarginPercent(quotation.amount, quotation.cost)}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge
                status={quotation.status}
                label={statusLabel(quotation.status)}
              />
            </dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Approval Chain</dt>
            <dd>{pendingApprovalText}</dd>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(quotation.createdAt).toLocaleString()}</dd>
          </div>
        </dl>

        {isEditable ? (
          <div className="mt-5 space-y-4 rounded-md border bg-muted/20 p-4 text-sm">
            <div>
              <h3 className="text-base font-semibold">Sales Pricing</h3>
              <p className="text-xs text-muted-foreground">
                {isReopenedForPo
                  ? "Re-opened after the client provided their PO. Adjust the pricing, then convert to a purchase order."
                  : isRejected
                    ? "Rejected. Adjust the pricing, then resubmit for approval."
                    : "Amounts are computed automatically from each item's direct cost. Margin, payment terms, and lead time are required before submitting for approval."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="unequal-margins"
                checked={hasUnequalMargins}
                onCheckedChange={(checked) => setHasUnequalMargins(checked === true)}
              />
              <Label htmlFor="unequal-margins" className="cursor-pointer">
                Unequal margins per item
              </Label>
            </div>

            {!hasUnequalMargins ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="sales-margin-percent">Margin %</Label>
                  <NumberInput
                    id="sales-margin-percent"
                    value={uniformMarginPercentage}
                    onValueChange={(value) => {
                      setUniformMarginPercentage(value);
                      applyUniformPercentage("marginPercentage", value);
                    }}
                    className="mt-1"
                    placeholder="e.g. 25"
                  />
                </div>
                <div>
                  <Label htmlFor="sales-bank-percent">Bank %</Label>
                  <NumberInput
                    id="sales-bank-percent"
                    value={uniformBankPercentage}
                    onValueChange={(value) => {
                      setUniformBankPercentage(value);
                      applyUniformPercentage("bankPercentage", value);
                    }}
                    className="mt-1"
                    placeholder="e.g. 3"
                  />
                </div>
                <div>
                  <Label htmlFor="sales-sop-percent">SOP %</Label>
                  <NumberInput
                    id="sales-sop-percent"
                    value={uniformSopPercentage}
                    onValueChange={(value) => {
                      setUniformSopPercentage(value);
                      applyUniformPercentage("sopPercentage", value);
                    }}
                    className="mt-1"
                    placeholder="e.g. 5"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  Select items below, enter percentages here, then apply to stamp them
                  onto the selected rows.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberInput
                    value={bulkMarginPercentage}
                    onValueChange={setBulkMarginPercentage}
                    placeholder="Margin %"
                  />
                  <NumberInput
                    value={bulkBankPercentage}
                    onValueChange={setBulkBankPercentage}
                    placeholder="Bank %"
                  />
                  <NumberInput
                    value={bulkSopPercentage}
                    onValueChange={setBulkSopPercentage}
                    placeholder="SOP %"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyBulkPercentages}
                  disabled={selectedItemIds.size === 0}
                >
                  Apply to selected ({selectedItemIds.size})
                </Button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] whitespace-nowrap text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    {hasUnequalMargins ? <th className="w-6 py-1"></th> : null}
                    <th className="py-1 pr-3 font-medium">Item</th>
                    <th className="py-1 pr-3 font-medium">Direct Cost</th>
                    <th className="py-1 pr-3 font-medium">Margin %</th>
                    <th className="py-1 pr-3 font-medium">Bank %</th>
                    <th className="py-1 pr-3 font-medium">SOP %</th>
                    <th className="py-1 pr-3 font-medium">Margin Amt</th>
                    <th className="py-1 pr-3 font-medium">Bank Amt</th>
                    <th className="py-1 pr-3 font-medium">SOP Amt</th>
                    <th className="py-1 font-medium">Selling</th>
                  </tr>
                </thead>
                <tbody>
                  {pricedItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      {hasUnequalMargins ? (
                        <td className="py-1">
                          <Checkbox
                            checked={selectedItemIds.has(item.id)}
                            onCheckedChange={(checked) =>
                              toggleItemSelected(item.id, checked === true)
                            }
                            aria-label={`Select ${item.description}`}
                          />
                        </td>
                      ) : null}
                      <td className="py-1 pr-3">{item.description}</td>
                      <td className="py-1 pr-3">{formatCurrency(item.directCost)}</td>
                      <td className="py-1 pr-3">
                        <NumberInput
                          value={item.marginPercentage}
                          onValueChange={(value) =>
                            updateItemPercentage(item.id, "marginPercentage", value)
                          }
                          disabled={!hasUnequalMargins}
                          className="h-7 w-20 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-3">
                        <NumberInput
                          value={item.bankPercentage}
                          onValueChange={(value) =>
                            updateItemPercentage(item.id, "bankPercentage", value)
                          }
                          disabled={!hasUnequalMargins}
                          className="h-7 w-20 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-3">
                        <NumberInput
                          value={item.sopPercentage}
                          onValueChange={(value) =>
                            updateItemPercentage(item.id, "sopPercentage", value)
                          }
                          disabled={!hasUnequalMargins}
                          className="h-7 w-20 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-3">{formatCurrency(item.marginAmount)}</td>
                      <td className="py-1 pr-3">{formatCurrency(item.bankAmount)}</td>
                      <td className="py-1 pr-3">{formatCurrency(item.sopAmount)}</td>
                      <td className="py-1">{formatCurrency(item.sellingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="py-1 pr-3" colSpan={hasUnequalMargins ? 2 : 1}>
                      Total
                    </td>
                    <td className="py-1 pr-3">{formatCurrency(pricing.directCost)}</td>
                    <td className="py-1 pr-3" colSpan={3}></td>
                    <td className="py-1 pr-3">{formatCurrency(pricing.marginAmount)}</td>
                    <td className="py-1 pr-3">{formatCurrency(pricing.bankAmount)}</td>
                    <td className="py-1 pr-3">{formatCurrency(pricing.sopAmount)}</td>
                    <td className="py-1">{formatCurrency(pricing.sellingAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2 border-t pt-3">
              <Label className="font-semibold">Selling Amount</Label>
              <span className="text-base font-semibold">
                {formatCurrency(pricing.sellingAmount)}
              </span>
            </div>

            {pricing.marginAmount > 0 ||
            pricing.bankAmount > 0 ||
            pricing.sopAmount > 0 ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Selling Amount</span>
                  <span>{formatCurrency(pricing.sellingAmount)}</span>
                </div>
                {pricing.marginAmount > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Margin VAT (12%)</span>
                    <span>{formatCurrency(vat.marginVat)}</span>
                  </div>
                ) : null}
                {pricing.bankAmount > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Bank VAT (12%)</span>
                    <span>{formatCurrency(vat.bankVat)}</span>
                  </div>
                ) : null}
                {pricing.sopAmount > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ SOP VAT (12%)</span>
                    <span>{formatCurrency(vat.sopVat)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Grand Total (incl. VAT)</span>
                  <span>{formatCurrency(vat.grandTotal)}</span>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sales-lead-time">Lead Time (days)</Label>
                <Input
                  id="sales-lead-time"
                  type="number"
                  min={0}
                  step="1"
                  value={leadTimeDays}
                  onChange={(event) => setLeadTimeDays(event.target.value)}
                  className="mt-1"
                  placeholder="e.g. 30"
                />
              </div>
              <div>
                <Label htmlFor="sales-payment-terms">Payment Terms</Label>
                <Select
                  value={paymentTermsSelect || undefined}
                  onValueChange={(value) => setPaymentTermsSelect(value)}
                >
                  <SelectTrigger id="sales-payment-terms" className="mt-1">
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {paymentTermsSelect === "Other" ? (
              <div>
                <Label htmlFor="sales-payment-terms-custom">Custom Payment Terms</Label>
                <textarea
                  id="sales-payment-terms-custom"
                  rows={2}
                  value={paymentTermsCustom}
                  onChange={(event) => setPaymentTermsCustom(event.target.value)}
                  className={textareaClassName}
                  placeholder="Describe the agreed payment terms"
                />
              </div>
            ) : null}

            <div>
              <Label>Google Drive Document</Label>
              {driveNotConfigured ? (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Drive upload not configured. Enter the link manually.
                  </p>
                  <Input
                    id="sales-drive-link"
                    type="url"
                    value={googleDriveLink}
                    onChange={(event) => setGoogleDriveLink(event.target.value)}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                    disabled={driveUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setDriveUploading(true);
                      setDriveUploadedName(null);
                      try {
                        const form = new FormData();
                        form.append("file", file);
                        const res = await fetch("/api/drive-upload", {
                          method: "POST",
                          body: form,
                        });
                        if (res.status === 503) {
                          setDriveNotConfigured(true);
                          return;
                        }
                        if (!res.ok) throw new Error("Upload failed.");
                        const data = (await res.json()) as { webViewLink: string };
                        setGoogleDriveLink(data.webViewLink);
                        setDriveUploadedName(file.name);
                      } catch {
                        error("File upload failed. Enter the Drive link manually.");
                        setDriveNotConfigured(true);
                      } finally {
                        setDriveUploading(false);
                      }
                    }}
                  />
                  {driveUploading ? (
                    <p className="text-xs text-muted-foreground">Uploading…</p>
                  ) : null}
                  {driveUploadedName && googleDriveLink ? (
                    <p className="text-xs">
                      Uploaded:{" "}
                      <a
                        href={googleDriveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {driveUploadedName}
                      </a>
                    </p>
                  ) : null}
                  {!driveUploadedName && googleDriveLink ? (
                    <p className="text-xs">
                      Current:{" "}
                      <a
                        href={googleDriveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        View file
                      </a>
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="sales-notes">Comments</Label>
              <textarea
                id="sales-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={textareaClassName}
                placeholder="Add any commercial notes or comments (optional)"
              />
            </div>
          </div>
        ) : (
          <>
            {quotation.items.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-md border bg-muted/20 p-4 text-sm">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Line Items & Pricing
                  {quotation.hasUnequalMargins ? (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-normal">
                      Unequal margins
                    </span>
                  ) : null}
                </p>
                <table className="w-full min-w-[720px] whitespace-nowrap text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Item</th>
                      <th className="py-1 pr-3 font-medium">Direct Cost</th>
                      <th className="py-1 pr-3 font-medium">Margin %</th>
                      <th className="py-1 pr-3 font-medium">Bank %</th>
                      <th className="py-1 pr-3 font-medium">SOP %</th>
                      <th className="py-1 pr-3 font-medium">Margin Amt</th>
                      <th className="py-1 pr-3 font-medium">Bank Amt</th>
                      <th className="py-1 pr-3 font-medium">SOP Amt</th>
                      <th className="py-1 font-medium">Selling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-1 pr-3">{item.description}</td>
                        <td className="py-1 pr-3">{formatCurrency(item.lineTotal)}</td>
                        <td className="py-1 pr-3">
                          {formatPercent(item.marginPercentage)}
                        </td>
                        <td className="py-1 pr-3">
                          {formatPercent(item.bankPercentage)}
                        </td>
                        <td className="py-1 pr-3">{formatPercent(item.sopPercentage)}</td>
                        <td className="py-1 pr-3">
                          {item.marginAmount === null
                            ? "—"
                            : formatCurrency(item.marginAmount)}
                        </td>
                        <td className="py-1 pr-3">
                          {item.bankAmount === null
                            ? "—"
                            : formatCurrency(item.bankAmount)}
                        </td>
                        <td className="py-1 pr-3">
                          {item.sopAmount === null ? "—" : formatCurrency(item.sopAmount)}
                        </td>
                        <td className="py-1">
                          {item.sellingAmount === null
                            ? "—"
                            : formatCurrency(item.sellingAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="py-1 pr-3">Total</td>
                      <td className="py-1 pr-3">{formatCurrency(quotation.cost ?? 0)}</td>
                      <td className="py-1 pr-3" colSpan={3}></td>
                      <td className="py-1 pr-3">
                        {formatCurrency(quotation.marginAmount ?? 0)}
                      </td>
                      <td className="py-1 pr-3">
                        {formatCurrency(quotation.bankAmount ?? 0)}
                      </td>
                      <td className="py-1 pr-3">
                        {formatCurrency(quotation.sopAmount ?? 0)}
                      </td>
                      <td className="py-1">
                        {formatCurrency(quotation.sellingAmount ?? quotation.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}

            <dl className="mt-5 grid gap-3 rounded-md border bg-muted/20 p-4 text-sm">
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Selling Amount</span>
                  <span>
                    {formatCurrency(quotation.sellingAmount ?? quotation.amount)}
                  </span>
                </div>
                {blendedVat.marginVat > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Margin VAT (12%)</span>
                    <span>{formatCurrency(blendedVat.marginVat)}</span>
                  </div>
                ) : null}
                {blendedVat.bankVat > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Bank VAT (12%)</span>
                    <span>{formatCurrency(blendedVat.bankVat)}</span>
                  </div>
                ) : null}
                {blendedVat.sopVat > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ SOP VAT (12%)</span>
                    <span>{formatCurrency(blendedVat.sopVat)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Grand Total</span>
                  <span>{formatCurrency(blendedVat.grandTotal)}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Payment Terms</dt>
                <dd>
                  {quotation.paymentTerms === "Other"
                    ? (quotation.paymentTermsCustom ?? "Other")
                    : (quotation.paymentTerms ?? "—")}
                </dd>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                <dt className="text-muted-foreground">Lead Time</dt>
                <dd>{formatLeadTime(quotation.leadTimeDays)}</dd>
              </div>
              {quotation.googleDriveLink ? (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">Google Drive</dt>
                  <dd>
                    <a
                      href={quotation.googleDriveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Open link
                    </a>
                  </dd>
                </div>
              ) : null}
              {quotation.notes ? (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                  <dt className="text-muted-foreground">Comments</dt>
                  <dd>{quotation.notes}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}

        {canEnterClientPo ? (
          <div className="mt-5 space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
            <div>
              <h3 className="text-base font-semibold">Client Confirmed?</h3>
              <p className="text-xs text-muted-foreground">
                When the client confirms and provides their PO, record it here to re-open
                the quotation for editing before converting it to a purchase order.
              </p>
            </div>
            <div>
              <Label htmlFor="client-po-number">Client PO Number</Label>
              <Input
                id="client-po-number"
                value={clientPoNumber}
                onChange={(event) => setClientPoNumber(event.target.value)}
                className="mt-1"
                placeholder="e.g. PO-2026-0142"
              />
            </div>
          </div>
        ) : null}

        {isReopenedForPo ? (
          <Callout tone="muted" className="mt-4 text-xs text-muted-foreground">
            Client PO{" "}
            <span className="font-medium text-foreground">
              {quotation.clientPoNumber}
            </span>{" "}
            recorded. Adjust the pricing above if needed, then convert to a purchase
            order.
          </Callout>
        ) : null}

        {isConverted ? (
          <Callout tone="success" className="mt-4">
            Converted to a purchase order
            {quotation.poConvertedAt
              ? ` on ${new Date(quotation.poConvertedAt).toLocaleDateString()}`
              : ""}
            . Track its approval and collections in the Purchase Orders module.
          </Callout>
        ) : null}

        {canApproveReject ? (
          <div className="mt-4 space-y-3">
            <Input
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Rejection reason (required for reject)"
              aria-label="Rejection reason"
            />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {isDraft && isOwner ? (
            <>
              <Button
                variant="outline"
                onClick={handleSaveSalesDetails}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Sales Details"}
              </Button>
              <Button
                onClick={handleSubmitForApproval}
                disabled={isSubmitting || !salesDetailsComplete}
              >
                {isSubmitting ? "Submitting..." : "Submit for Approval"}
              </Button>
            </>
          ) : null}

          {canEnterClientPo ? (
            <Button onClick={handleMarkClientPo} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Record Client PO"}
            </Button>
          ) : null}

          {isReopenedForPo && isOwner ? (
            <>
              <Button
                variant="outline"
                onClick={handleSaveSalesDetails}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={handleConvertToPo}
                disabled={isSubmitting || !salesDetailsComplete}
              >
                {isSubmitting ? "Converting..." : "Convert to Purchase Order"}
              </Button>
            </>
          ) : null}

          {canApproveReject ? (
            <>
              <Button onClick={handleApprove} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Approve"}
              </Button>
              <Button variant="outline" onClick={handleReject} disabled={isSubmitting}>
                Reject
              </Button>
            </>
          ) : null}

          {isRejected && isOwner ? (
            <>
              <Button
                variant="outline"
                onClick={handleSaveSalesDetails}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={handleResubmit}
                disabled={isSubmitting || !salesDetailsComplete}
              >
                {isSubmitting ? "Resubmitting..." : "Resubmit for Approval"}
              </Button>
            </>
          ) : null}

          {isClosed ? (
            <p className="text-sm text-muted-foreground">
              This quotation has been converted to a purchase order and is now read-only.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
