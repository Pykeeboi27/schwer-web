"use client";

import {
  approvePurchaseOrderAction,
  createProofOfPaymentSignedUrlAction,
  deleteCollectionAction,
  deleteEncodedPurchaseOrderAction,
  rejectPurchaseOrderAction,
  resubmitPurchaseOrderAction,
  updatePurchaseOrderDetailsAction,
  type PurchaseOrderItemPricingFormInput,
} from "@/app/protected/sales/purchase-orders/actions";
import { RecordCollectionDialog } from "@/components/dialogs/record-collection-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Callout,
  ConfirmDialog,
  PricingBreakdown,
  StatusBadge,
  TruncatedText,
} from "@/components/patterns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeAggregatePricing, computeSalesPricing } from "@/lib/sales/pricing";
import type { SalesPoPayment, SalesPurchaseOrder } from "@/lib/sales/purchase-orders";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PurchaseOrderDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: SalesPurchaseOrder | null;
  payments: SalesPoPayment[];
  currentUserId: string;
  currentUserRole: string | null;
};

const PAYMENT_TERMS_OPTIONS = [
  "50% Down Payment, 50% Upon Delivery",
  "15 Days",
  "30 Days",
  "Other",
] as const;

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function progressOf(purchaseOrder: SalesPurchaseOrder): number {
  if (purchaseOrder.poAmount <= 0) return 0;
  return Math.min(
    100,
    Math.round((purchaseOrder.recognizedAmount / purchaseOrder.poAmount) * 100),
  );
}

function roleLabel(role: "sales_manager" | "owner" | "executive"): string {
  if (role === "sales_manager") {
    return "Sales Manager";
  }

  if (role === "owner") {
    return "Owner";
  }

  return "Executive";
}

function stageStateLabel(state: "approved" | "current" | "upcoming"): string {
  if (state === "approved") {
    return "Approved";
  }

  if (state === "current") {
    return "Pending";
  }

  return "Upcoming";
}

/**
 * Renders the full sequential chain with each stage's state, since only the
 * current stage's approval row actually exists at any given time -- e.g.
 * "Sales Manager (Approved) -> Executive (Pending) -> Owner (Upcoming)".
 */
function formatApprovalStages(stages: SalesPurchaseOrder["approvalStages"]): string {
  if (stages.length === 0) {
    return "No approvers required";
  }

  return stages
    .map((stage) => `${roleLabel(stage.role)} (${stageStateLabel(stage.state)})`)
    .join(" -> ");
}

type ItemPricingFields = {
  marginPercentage: string;
  bankPercentage: string;
  sopPercentage: string;
};

// Margin defaults to 25% (SPMC's standard MARKUP% across its costing sheets)
// for new/unpriced items -- still fully editable. Bank% and SOP% have no such
// standard and stay blank until the sales rep enters them.
const DEFAULT_MARGIN_PERCENTAGE = "25";

const emptyItemPricing: ItemPricingFields = {
  marginPercentage: DEFAULT_MARGIN_PERCENTAGE,
  bankPercentage: "",
  sopPercentage: "",
};

export function PurchaseOrderDetailsDialog({
  open,
  onOpenChange,
  purchaseOrder,
  payments,
  currentUserId,
  currentUserRole,
}: PurchaseOrderDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SalesPoPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<SalesPoPayment | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [deletePoDialogOpen, setDeletePoDialogOpen] = useState(false);
  const [isDeletingPo, setIsDeletingPo] = useState(false);
  const [viewingProofPaymentId, setViewingProofPaymentId] = useState<string | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editClientPoNumber, setEditClientPoNumber] = useState("");
  const [editQuotationReference, setEditQuotationReference] = useState("");
  const [hasUnequalMargins, setHasUnequalMargins] = useState(false);
  const [itemPricing, setItemPricing] = useState<Record<string, ItemPricingFields>>({});
  const [uniformMarginPercentage, setUniformMarginPercentage] = useState("");
  const [uniformBankPercentage, setUniformBankPercentage] = useState("");
  const [uniformSopPercentage, setUniformSopPercentage] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkMarginPercentage, setBulkMarginPercentage] = useState("");
  const [bulkBankPercentage, setBulkBankPercentage] = useState("");
  const [bulkSopPercentage, setBulkSopPercentage] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [paymentTermsSelect, setPaymentTermsSelect] = useState("");
  const [paymentTermsCustom, setPaymentTermsCustom] = useState("");

  const normalizedRole = String(currentUserRole ?? "")
    .trim()
    .toLowerCase();

  // Only the sales person who created (converted) the PO may edit or record
  // collections against it; everyone else in the department sees the same
  // details read-only (approvers are exempt — see canApproveReject below).
  const isOwner = Boolean(purchaseOrder && purchaseOrder.createdBy === currentUserId);

  const paymentHistory = useMemo(() => {
    if (!purchaseOrder) {
      return [];
    }
    return payments.filter((payment) => payment.purchaseOrderId === purchaseOrder.id);
  }, [payments, purchaseOrder]);

  const handleClose = () => {
    setRecordDialogOpen(false);
    setEditingPayment(null);
    setDeletingPayment(null);
    setDeletePoDialogOpen(false);
    setRejectionReason("");
    onOpenChange(false);
  };

  const handleDeletePo = async () => {
    if (!purchaseOrder) {
      return;
    }
    setIsDeletingPo(true);
    const response = await deleteEncodedPurchaseOrderAction(purchaseOrder.id);
    if (!response.success) {
      error(response.error ?? "Failed to delete the purchase order.");
      setIsDeletingPo(false);
      return;
    }
    success(`Deleted ${purchaseOrder.poNumber}.`);
    setIsDeletingPo(false);
    handleClose();
    router.refresh();
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment || !purchaseOrder) {
      return;
    }
    setIsDeletingPayment(true);
    const response = await deleteCollectionAction(deletingPayment.id, purchaseOrder.id);
    if (!response.success) {
      error(response.error ?? "Failed to delete collection.");
      setIsDeletingPayment(false);
      return;
    }
    success("Collection deleted.");
    setDeletingPayment(null);
    setIsDeletingPayment(false);
    router.refresh();
  };

  const handleViewProof = async (payment: SalesPoPayment) => {
    if (!payment.proofPath) {
      return;
    }
    setViewingProofPaymentId(payment.id);
    const response = await createProofOfPaymentSignedUrlAction(payment.proofPath);
    setViewingProofPaymentId(null);
    if (!response.success || !response.data) {
      error(response.error ?? "Failed to load proof of payment.");
      return;
    }
    setProofPreviewUrl(response.data.url);
  };

  useEffect(() => {
    if (!open || !purchaseOrder) {
      return;
    }
    setEditClientPoNumber(purchaseOrder.clientPoNumber ?? "");
    setEditQuotationReference(purchaseOrder.quotationReference ?? "");
    setHasUnequalMargins(purchaseOrder.hasUnequalMargins);
    const nextItemPricing: Record<string, ItemPricingFields> = {};
    purchaseOrder.items.forEach((item) => {
      nextItemPricing[item.id] = {
        marginPercentage:
          item.marginPercentage === null
            ? DEFAULT_MARGIN_PERCENTAGE
            : String(item.marginPercentage),
        bankPercentage: item.bankPercentage === null ? "" : String(item.bankPercentage),
        sopPercentage: item.sopPercentage === null ? "" : String(item.sopPercentage),
      };
    });
    setItemPricing(nextItemPricing);
    // Mirrors the quotation dialog: the uniform-mode fields track the first
    // item's values, which are kept equal across all items when unticked.
    const firstItem = purchaseOrder.items[0];
    setUniformMarginPercentage(
      firstItem && firstItem.marginPercentage !== null
        ? String(firstItem.marginPercentage)
        : DEFAULT_MARGIN_PERCENTAGE,
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
    setLeadTimeDays(
      purchaseOrder.leadTimeDays === null ? "" : String(purchaseOrder.leadTimeDays),
    );

    // Map the stored payment terms back onto the dropdown + custom field.
    const storedTerms = purchaseOrder.paymentTerms ?? "";
    if (
      storedTerms !== "" &&
      !PAYMENT_TERMS_OPTIONS.includes(
        storedTerms as (typeof PAYMENT_TERMS_OPTIONS)[number],
      )
    ) {
      setPaymentTermsSelect("Other");
      setPaymentTermsCustom(purchaseOrder.paymentTermsCustom ?? storedTerms);
    } else if (storedTerms === "Other") {
      setPaymentTermsSelect("Other");
      setPaymentTermsCustom(purchaseOrder.paymentTermsCustom ?? "");
    } else {
      setPaymentTermsSelect(storedTerms);
      setPaymentTermsCustom("");
    }
  }, [open, purchaseOrder]);

  if (!purchaseOrder) {
    return null;
  }

  const isRejected = purchaseOrder.status === "rejected";
  const isApproved = purchaseOrder.status === "approved";
  // Manually-encoded POs stay permanently approved with no rejection/resubmit
  // cycle, so their edit access is gated on the coordinator role instead of
  // ownership + rejected status.
  const isEncodedEditable =
    purchaseOrder.isManuallyEncoded && normalizedRole === "coordinator";
  const isEditable = (isRejected && isOwner) || isEncodedEditable;
  const canApproveReject =
    purchaseOrder.status === "pending" &&
    purchaseOrder.pendingApprovalRoles.includes(
      normalizedRole as "sales_manager" | "owner" | "executive",
    );

  // Per-item live pricing preview, mirroring the quotation dialog: each
  // item's own direct cost (line total) is priced individually, then rolled
  // into one aggregate for the totals footer.
  const pricedItems = purchaseOrder.items.map((item) => {
    const row = itemPricing[item.id] ?? emptyItemPricing;
    const itemPricingResult = computeSalesPricing({
      directCost: item.lineTotal,
      quantity: item.quantity,
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

  const pricingPreview = computeAggregatePricing(pricedItems);

  /** Unticked mode: writing one field broadcasts it onto every item's pricing. */
  const applyUniformPercentage = (field: keyof ItemPricingFields, value: string) => {
    setItemPricing((prev) => {
      const next = { ...prev };
      for (const item of purchaseOrder.items) {
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

  const handleApprove = async () => {
    setIsSubmitting(true);
    const response = await approvePurchaseOrderAction(purchaseOrder.id, normalizedRole);
    if (!response.success) {
      error(response.error ?? "Failed to approve purchase order.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order approved.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    if (rejectionReason.trim() === "") {
      error("Please provide a rejection reason.");
      return;
    }
    setIsSubmitting(true);
    const response = await rejectPurchaseOrderAction(
      purchaseOrder.id,
      rejectionReason.trim(),
      normalizedRole,
    );
    if (!response.success) {
      error(response.error ?? "Failed to reject purchase order.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order rejected.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleSaveDetails = async () => {
    const trimmedLeadTime = leadTimeDays.trim();

    const itemsPayload: PurchaseOrderItemPricingFormInput[] = [];
    for (const item of purchaseOrder.items) {
      const row = itemPricing[item.id] ?? emptyItemPricing;
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
        }
      }
      itemsPayload.push({
        id: item.id,
        marginPercentage: row.marginPercentage.trim(),
        bankPercentage: row.bankPercentage.trim(),
        sopPercentage: row.sopPercentage.trim(),
      });
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
    const response = await updatePurchaseOrderDetailsAction(purchaseOrder.id, {
      hasUnequalMargins,
      items: itemsPayload,
      paymentTerms: paymentTermsSelect.trim(),
      paymentTermsCustom: paymentTermsCustom.trim(),
      leadTimeDays: trimmedLeadTime,
      clientPoNumber: editClientPoNumber.trim(),
      quotationReference: editQuotationReference.trim(),
    });
    if (!response.success) {
      error(response.error ?? "Failed to save purchase order details.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order details saved.");
    setIsSubmitting(false);
    router.refresh();
  };

  const handleResubmit = async () => {
    setIsSubmitting(true);
    const response = await resubmitPurchaseOrderAction(purchaseOrder.id);
    if (!response.success) {
      error(response.error ?? "Failed to resubmit purchase order.");
      setIsSubmitting(false);
      return;
    }
    success("Purchase order resubmitted for approval.");
    handleClose();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] max-w-2xl overflow-y-auto lg:max-w-6xl",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Purchase Order Details
              {purchaseOrder.isManuallyEncoded ? (
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                  Manually Encoded
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {purchaseOrder.isManuallyEncoded
                ? isEncodedEditable
                  ? "Backfilled record with no approval workflow. As coordinator, you can edit and save changes directly."
                  : "Backfilled record with no approval workflow. Only the coordinator can edit it."
                : !isOwner && !canApproveReject
                  ? "This purchase order belongs to another sales person and is read-only."
                  : isRejected
                    ? "This purchase order was rejected. Update the pricing, then resubmit for approval."
                    : "Review details and process approval actions."}
            </DialogDescription>
          </DialogHeader>

          {isRejected && purchaseOrder.rejectionReason ? (
            <Callout
              tone="destructive"
              title={`Rejected by ${purchaseOrder.rejectedByName ?? "Unknown"}`}
            >
              <p className="text-foreground">{purchaseOrder.rejectionReason}</p>
            </Callout>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                window.open(
                  `/api/sales/purchase-orders/${purchaseOrder.id}/worksheet`,
                  "_blank",
                )
              }
            >
              Download Worksheet
            </Button>
          </div>

          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="items">Line Items</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="space-y-3 rounded-md border p-4 text-sm">
                <dl className="grid gap-3">
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">PO #</dt>
                    <dd className="font-medium">{purchaseOrder.poNumber}</dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Client PO #</dt>
                    <dd>
                      {isEditable ? (
                        <Input
                          value={editClientPoNumber}
                          onChange={(e) =>
                            setEditClientPoNumber(e.target.value.toUpperCase())
                          }
                          placeholder="Client PO number"
                          className="h-8"
                        />
                      ) : (
                        (purchaseOrder.clientPoNumber ?? "—")
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Quotation Ref.</dt>
                    <dd>
                      {isEditable ? (
                        <Input
                          value={editQuotationReference}
                          onChange={(e) =>
                            setEditQuotationReference(e.target.value.toUpperCase())
                          }
                          placeholder="Quotation reference"
                          className="h-8"
                        />
                      ) : (
                        (purchaseOrder.quotationReference ?? "—")
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Client</dt>
                    <dd>{purchaseOrder.clientName}</dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Authored By</dt>
                    <dd>{purchaseOrder.createdByName}</dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Subject</dt>
                    <dd>{purchaseOrder.subject}</dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Approval Status</dt>
                    <dd>
                      <StatusBadge status={purchaseOrder.status} />
                    </dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Approval Chain</dt>
                    <dd>
                      {purchaseOrder.isManuallyEncoded
                        ? "No approval workflow (manually encoded)"
                        : formatApprovalStages(purchaseOrder.approvalStages)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Approved At</dt>
                    <dd>{formatDateTime(purchaseOrder.approvedAt)}</dd>
                  </div>
                </dl>
              </div>

              {purchaseOrder.isManuallyEncoded && normalizedRole === "coordinator" ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletePoDialogOpen(true)}
                  >
                    Delete Purchase Order
                  </Button>
                </div>
              ) : null}

              {canApproveReject ? (
                <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                  <h3 className="text-base font-semibold">PO Approval</h3>
                  <Input
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Rejection reason (required for reject)"
                    aria-label="Rejection reason"
                  />
                  <div className="flex justify-end gap-2">
                    <Button onClick={handleApprove} disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : "Approve"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReject}
                      disabled={isSubmitting}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="items">
              <div className="space-y-3 overflow-x-auto rounded-md border p-4 text-sm">
                {purchaseOrder.hasUnequalMargins ? (
                  <span className="inline-block rounded-full border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                    Unequal margins
                  </span>
                ) : null}
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Item</th>
                      <th className="py-1 pr-3 font-medium">Qty</th>
                      <th className="py-1 pr-3 font-medium">Unit Cost</th>
                      <th className="py-1 pr-3 font-medium">Line Total</th>
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
                    {purchaseOrder.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-1 pr-3">
                          <TruncatedText>{item.description}</TruncatedText>
                        </td>
                        <td className="py-1 pr-3">{item.quantity}</td>
                        <td className="py-1 pr-3">
                          {item.unitCost === null ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            formatCurrency(item.unitCost)
                          )}
                        </td>
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
                    <tr className="border-t font-semibold">
                      <td className="py-1 pr-3" colSpan={3}>
                        Total
                      </td>
                      <td className="py-1 pr-3">
                        {formatCurrency(purchaseOrder.cost ?? 0)}
                      </td>
                      <td className="py-1 pr-3" colSpan={3}></td>
                      <td className="py-1 pr-3">
                        {formatCurrency(purchaseOrder.marginAmount ?? 0)}
                      </td>
                      <td className="py-1 pr-3">
                        {formatCurrency(purchaseOrder.bankAmount ?? 0)}
                      </td>
                      <td className="py-1 pr-3">
                        {formatCurrency(purchaseOrder.sopAmount ?? 0)}
                      </td>
                      <td className="py-1">
                        {formatCurrency(
                          purchaseOrder.sellingAmount ?? purchaseOrder.poAmount,
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="pricing">
              <div className="space-y-3 rounded-md border p-4 text-sm">
                {isEditable ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="po-unequal-margins"
                        checked={hasUnequalMargins}
                        onCheckedChange={(checked) =>
                          setHasUnequalMargins(checked === true)
                        }
                      />
                      <Label htmlFor="po-unequal-margins" className="cursor-pointer">
                        Unequal margins per item
                      </Label>
                    </div>

                    {!hasUnequalMargins ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label htmlFor="po-margin-percent">Margin %</Label>
                          <NumberInput
                            id="po-margin-percent"
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
                          <Label htmlFor="po-bank-percent">Bank %</Label>
                          <NumberInput
                            id="po-bank-percent"
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
                          <Label htmlFor="po-sop-percent">SOP %</Label>
                          <NumberInput
                            id="po-sop-percent"
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
                          Select items below, enter percentages here, then apply to stamp
                          them onto the selected rows.
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
                      <table className="w-full text-xs">
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
                              <td className="py-1 pr-3">
                                <TruncatedText>{item.description}</TruncatedText>
                              </td>
                              <td className="py-1 pr-3">
                                {formatCurrency(item.directCost)}
                              </td>
                              <td className="py-1 pr-3">
                                <NumberInput
                                  value={item.marginPercentage}
                                  onValueChange={(value) =>
                                    updateItemPercentage(
                                      item.id,
                                      "marginPercentage",
                                      value,
                                    )
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
                              <td className="py-1 pr-3">
                                {formatCurrency(item.marginAmount)}
                              </td>
                              <td className="py-1 pr-3">
                                {formatCurrency(item.bankAmount)}
                              </td>
                              <td className="py-1 pr-3">
                                {formatCurrency(item.sopAmount)}
                              </td>
                              <td className="py-1">
                                {formatCurrency(item.sellingAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t font-semibold">
                            <td className="py-1 pr-3" colSpan={hasUnequalMargins ? 2 : 1}>
                              Total
                            </td>
                            <td className="py-1 pr-3">
                              {formatCurrency(pricingPreview.directCost)}
                            </td>
                            <td className="py-1 pr-3" colSpan={3}></td>
                            <td className="py-1 pr-3">
                              {formatCurrency(pricingPreview.marginAmount)}
                            </td>
                            <td className="py-1 pr-3">
                              {formatCurrency(pricingPreview.bankAmount)}
                            </td>
                            <td className="py-1 pr-3">
                              {formatCurrency(pricingPreview.sopAmount)}
                            </td>
                            <td className="py-1">
                              {formatCurrency(pricingPreview.sellingAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <PricingBreakdown
                      directCost={pricingPreview.directCost}
                      marginAmount={pricingPreview.marginAmount}
                      bankAmount={pricingPreview.bankAmount}
                      sopAmount={pricingPreview.sopAmount}
                      sellingAmount={pricingPreview.sellingAmount}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="po-lead-time">Lead Time (days)</Label>
                        <Input
                          id="po-lead-time"
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
                        <Label htmlFor="po-payment-terms">Payment Terms</Label>
                        <Select
                          value={paymentTermsSelect || undefined}
                          onValueChange={(value) => setPaymentTermsSelect(value)}
                        >
                          <SelectTrigger id="po-payment-terms" className="mt-1">
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
                        <Label htmlFor="po-payment-terms-custom">
                          Custom Payment Terms
                        </Label>
                        <Input
                          id="po-payment-terms-custom"
                          value={paymentTermsCustom}
                          onChange={(event) => setPaymentTermsCustom(event.target.value)}
                          className="mt-1"
                          placeholder="Describe the agreed payment terms"
                        />
                      </div>
                    ) : null}

                    <div className="flex justify-end gap-2 border-t pt-3">
                      <Button
                        variant={isRejected ? "outline" : "default"}
                        onClick={handleSaveDetails}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Saving..." : "Save Changes"}
                      </Button>
                      {isRejected ? (
                        <Button onClick={handleResubmit} disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Submit for Approval"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <dl className="grid gap-3">
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-muted-foreground">Direct Cost</dt>
                      <dd>
                        {purchaseOrder.cost === null
                          ? "—"
                          : formatCurrency(purchaseOrder.cost)}
                      </dd>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Per-item breakdown is on the Line Items tab.
                    </p>
                    <PricingBreakdown
                      directCost={purchaseOrder.cost ?? 0}
                      marginAmount={purchaseOrder.marginAmount ?? 0}
                      bankAmount={purchaseOrder.bankAmount ?? 0}
                      sopAmount={purchaseOrder.sopAmount ?? 0}
                      sellingAmount={
                        purchaseOrder.sellingAmount ?? purchaseOrder.poAmount
                      }
                    />
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-muted-foreground">Payment Terms</dt>
                      <dd>
                        {purchaseOrder.paymentTerms === "Other"
                          ? (purchaseOrder.paymentTermsCustom ?? "Other")
                          : (purchaseOrder.paymentTerms ?? "—")}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-muted-foreground">Lead Time</dt>
                      <dd>
                        {purchaseOrder.leadTimeDays === null
                          ? "—"
                          : `${purchaseOrder.leadTimeDays} day${
                              purchaseOrder.leadTimeDays === 1 ? "" : "s"
                            }`}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </TabsContent>

            <TabsContent value="payment">
              <div className="space-y-3 rounded-md border p-4 text-sm">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    Collected {formatCurrency(purchaseOrder.recognizedAmount)} of{" "}
                    {formatCurrency(purchaseOrder.poAmount)} ({progressOf(purchaseOrder)}
                    %)
                  </p>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${progressOf(purchaseOrder)}%` }}
                    />
                  </div>
                </div>

                <dl className="grid gap-3">
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Total Amount</dt>
                    <dd className="font-semibold">
                      {formatCurrency(purchaseOrder.poAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Collected Amount</dt>
                    <dd>{formatCurrency(purchaseOrder.recognizedAmount)}</dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Remaining Balance</dt>
                    <dd>
                      {formatCurrency(
                        Math.max(
                          purchaseOrder.poAmount - purchaseOrder.recognizedAmount,
                          0,
                        ),
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">Payment Status</dt>
                    <dd>
                      <StatusBadge status={purchaseOrder.paymentStatus} />
                    </dd>
                  </div>
                </dl>

                {isApproved ? (
                  <div className="mt-2">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Collection History</h4>
                      {isOwner ? (
                        <Button type="button" onClick={() => setRecordDialogOpen(true)}>
                          Record Collection
                        </Button>
                      ) : null}
                    </div>

                    <div className="max-h-64 space-y-2 overflow-auto rounded border p-3">
                      {paymentHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No collections recorded yet.
                        </p>
                      ) : (
                        paymentHistory.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-start justify-between gap-2 rounded border p-2 text-sm"
                          >
                            <div>
                              <p className="font-medium">
                                {formatCurrency(payment.amountCollected)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(payment.paymentDate).toLocaleDateString()}
                                {payment.paymentMethod
                                  ? ` • ${payment.paymentMethod}`
                                  : ""}
                                {payment.referenceNumber
                                  ? ` • ${payment.referenceNumber}`
                                  : ""}
                              </p>
                              {payment.proofPath ? (
                                <button
                                  type="button"
                                  className="mt-1 text-xs text-primary underline disabled:opacity-50"
                                  disabled={viewingProofPaymentId === payment.id}
                                  onClick={() => handleViewProof(payment)}
                                >
                                  {viewingProofPaymentId === payment.id
                                    ? "Loading..."
                                    : "View proof"}
                                </button>
                              ) : null}
                            </div>
                            {isOwner ? (
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  aria-label={`Edit collection of ${formatCurrency(payment.amountCollected)}`}
                                  onClick={() => setEditingPayment(payment)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  aria-label={`Delete collection of ${formatCurrency(payment.amountCollected)}`}
                                  onClick={() => setDeletingPayment(payment)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                    {!isOwner ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Only the sales person who owns this purchase order can record
                        collections.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(proofPreviewUrl)}
        onOpenChange={(next) => {
          if (!next) setProofPreviewUrl(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proof of Payment</DialogTitle>
          </DialogHeader>
          {proofPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset
            <img
              src={proofPreviewUrl}
              alt="Proof of payment"
              className="max-h-[75vh] w-full rounded-md border object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <RecordCollectionDialog
        open={recordDialogOpen}
        purchaseOrder={purchaseOrder}
        userId={currentUserId}
        onOpenChange={setRecordDialogOpen}
      />

      <RecordCollectionDialog
        open={Boolean(editingPayment)}
        purchaseOrder={purchaseOrder}
        userId={currentUserId}
        mode="edit"
        payment={editingPayment}
        onOpenChange={(next) => {
          if (!next) setEditingPayment(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onOpenChange={(next) => {
          if (!next) setDeletingPayment(null);
        }}
        title="Delete this collection?"
        description={
          deletingPayment
            ? `Are you sure you want to delete the ${formatCurrency(deletingPayment.amountCollected)} collection recorded on ${new Date(deletingPayment.paymentDate).toLocaleDateString()}? This cannot be undone and will recalculate the PO's collected total.`
            : ""
        }
        confirmLabel="Delete"
        isBusy={isDeletingPayment}
        onConfirm={handleDeletePayment}
      />

      <ConfirmDialog
        open={deletePoDialogOpen}
        onOpenChange={setDeletePoDialogOpen}
        title="Delete this purchase order?"
        description={`This permanently deletes ${purchaseOrder.poNumber} and any payments recorded against it. This cannot be undone -- you'll need to re-encode it from scratch if this was a mistake.`}
        confirmLabel="Delete"
        isBusy={isDeletingPo}
        onConfirm={handleDeletePo}
      />
    </>
  );
}
