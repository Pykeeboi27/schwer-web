"use client";

import { encodeExistingPurchaseOrderAction } from "@/app/protected/sales/purchase-orders/actions";
import { ProofOfPaymentField } from "@/components/dialogs/proof-of-payment-field";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Callout,
  ConfirmDialog,
  DataCard,
  DataField,
  PricingBreakdown,
  ResponsiveTable,
} from "@/components/patterns";
import { computeLandedUnitCost } from "@/lib/engineering/landed-cost";
import {
  computeAggregatePricing,
  computeSalesPricing,
  round2,
} from "@/lib/sales/pricing";
import {
  buildProofOfPaymentPath,
  PROOF_OF_PAYMENT_BUCKET,
} from "@/lib/sales/proof-of-payment";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/number-format";
import { useToast } from "@/lib/utils/toast-notification";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
};

type EncodeExistingPoDialogProps = {
  clients: ClientOption[];
  /** Current signed-in user's id -- used to scope proof-of-payment storage paths. */
  userId: string;
};

const PAYMENT_TERMS_OPTIONS = [
  "50% Down Payment, 50% Upon Delivery",
  "15 Days",
  "30 Days",
  "Other",
] as const;

const DEFAULT_MARGIN_PERCENTAGE = "25";

type ItemRow = {
  key: string;
  description: string;
  quantity: string;
  rawCost: string;
  marginPercentage: string;
  bankPercentage: string;
  sopPercentage: string;
};

type PaymentRow = {
  key: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
  proofFile: File | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyItemRow(): ItemRow {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "1",
    rawCost: "",
    marginPercentage: DEFAULT_MARGIN_PERCENTAGE,
    bankPercentage: "",
    sopPercentage: "",
  };
}

function emptyPaymentRow(): PaymentRow {
  return {
    key: crypto.randomUUID(),
    amount: "",
    paymentDate: todayIso(),
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
    proofFile: null,
  };
}

type StepId = "details" | "cost" | "margins" | "review" | "payments";

const STEP_LABELS: Record<StepId, string> = {
  details: "1. Details & Items",
  cost: "2. Raw Cost",
  margins: "3. Margins",
  review: "4. Review",
  payments: "5. Payments",
};

/**
 * Existing Purchase Order Encoding: a step-gated wizard for backfilling an
 * already-existing, already-won PO for record-keeping. No approval workflow,
 * no engineering costing handoff -- sales enters raw cost and margins
 * themselves. Nothing hits the database until the final confirmation; the
 * whole record (PO + items + any historical payments) is then written in one
 * atomic call (encodeExistingPurchaseOrderAction -> fn_encode_existing_po,
 * migrations/0027).
 */
export function EncodeExistingPoDialog({ clients, userId }: EncodeExistingPoDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const formId = useId();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StepId>("details");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [poNumber, setPoNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [subject, setSubject] = useState("");
  const [clientPoNumber, setClientPoNumber] = useState("");
  const [quotationReference, setQuotationReference] = useState("");
  const [poDate, setPoDate] = useState(todayIso());
  const [items, setItems] = useState<ItemRow[]>([emptyItemRow()]);

  const [hasUnequalMargins, setHasUnequalMargins] = useState(false);
  const [uniformMargin, setUniformMargin] = useState(DEFAULT_MARGIN_PERCENTAGE);
  const [uniformBank, setUniformBank] = useState("");
  const [uniformSop, setUniformSop] = useState("");
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const [bulkMargin, setBulkMargin] = useState("");
  const [bulkBank, setBulkBank] = useState("");
  const [bulkSop, setBulkSop] = useState("");
  const [paymentTermsSelect, setPaymentTermsSelect] = useState("");
  const [paymentTermsCustom, setPaymentTermsCustom] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");

  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const closeDialog = () => {
    setOpen(false);
    setConfirmOpen(false);
    setIsSubmitting(false);
    setActiveTab("details");
    setPoNumber("");
    setClientId("");
    setSubject("");
    setClientPoNumber("");
    setQuotationReference("");
    setPoDate(todayIso());
    setItems([emptyItemRow()]);
    setHasUnequalMargins(false);
    setUniformMargin(DEFAULT_MARGIN_PERCENTAGE);
    setUniformBank("");
    setUniformSop("");
    setSelectedItemKeys(new Set());
    setBulkMargin("");
    setBulkBank("");
    setBulkSop("");
    setPaymentTermsSelect("");
    setPaymentTermsCustom("");
    setLeadTimeDays("");
    setPayments([]);
  };

  const updateItem = (key: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)));
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  /** Unticked mode: writing one field broadcasts it onto every item. */
  const applyUniformPercentage = (
    field: "marginPercentage" | "bankPercentage" | "sopPercentage",
    value: string,
  ) => {
    setItems((prev) => prev.map((row) => ({ ...row, [field]: value })));
  };

  const toggleItemSelected = (key: string, checked: boolean) => {
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  /** Ticked mode: stamps the bulk %s onto every selected item, once. */
  const applyBulkPercentages = () => {
    if (selectedItemKeys.size === 0) {
      error("Select at least one item to apply pricing to.");
      return;
    }
    setItems((prev) =>
      prev.map((row) =>
        selectedItemKeys.has(row.key)
          ? {
              ...row,
              marginPercentage:
                bulkMargin.trim() !== "" ? bulkMargin : row.marginPercentage,
              bankPercentage: bulkBank.trim() !== "" ? bulkBank : row.bankPercentage,
              sopPercentage: bulkSop.trim() !== "" ? bulkSop : row.sopPercentage,
            }
          : row,
      ),
    );
  };

  const addPaymentRow = () => setPayments((prev) => [...prev, emptyPaymentRow()]);
  const removePaymentRow = (key: string) =>
    setPayments((prev) => prev.filter((row) => row.key !== key));
  const updatePayment = (key: string, patch: Partial<PaymentRow>) =>
    setPayments((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  // Live pricing preview -- same waterfall every other pricing surface uses.
  // directCost is an estimate (quantity x landed unit cost) since there's no
  // DB row yet to read an authoritative line_total back from; the list page
  // re-derives the real figures from the stored line_total on every load.
  const pricedItems = items.map((item) => {
    const rawCost = Number(item.rawCost) || 0;
    const quantity = Number(item.quantity) || 0;
    const unitCost = computeLandedUnitCost(rawCost);
    const directCost = round2(unitCost * quantity);
    const pricing = computeSalesPricing({
      directCost,
      quantity,
      marginPercentage: Number(item.marginPercentage) || 0,
      bankPercentage: Number(item.bankPercentage) || 0,
      sopPercentage: Number(item.sopPercentage) || 0,
    });
    return { ...item, unitCost, directCost, ...pricing };
  });

  const pricing = computeAggregatePricing(pricedItems);

  const paymentTermsResolved =
    paymentTermsSelect === "Other"
      ? paymentTermsCustom.trim()
      : paymentTermsSelect.trim();

  const step1Valid =
    poNumber.trim() !== "" &&
    clientId !== "" &&
    subject.trim() !== "" &&
    poDate !== "" &&
    items.length > 0 &&
    items.every((item) => item.description.trim() !== "" && Number(item.quantity) > 0);

  const step2Valid = step1Valid && items.every((item) => Number(item.rawCost) > 0);

  const step3Valid =
    step2Valid &&
    items.every((item) => item.marginPercentage.trim() !== "") &&
    paymentTermsResolved !== "" &&
    leadTimeDays.trim() !== "";

  const unlocked: Record<StepId, boolean> = {
    details: true,
    cost: step1Valid,
    margins: step2Valid,
    review: step3Valid,
    payments: step3Valid,
  };

  const goTo = (step: StepId) => {
    if (unlocked[step]) setActiveTab(step);
  };

  const clientName = clients.find((c) => c.id === clientId)?.companyName ?? "—";

  const totalPayments = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    const supabase = createClient();
    const uploadedPaths: string[] = [];

    try {
      const paymentsPayload = [];
      for (const payment of payments) {
        if (!payment.proofFile) {
          throw new Error("Every payment needs a proof-of-payment photo.");
        }
        const path = buildProofOfPaymentPath(userId, crypto.randomUUID());
        const { error: uploadError } = await supabase.storage
          .from(PROOF_OF_PAYMENT_BUCKET)
          .upload(path, payment.proofFile, { contentType: "image/webp" });
        if (uploadError) {
          throw new Error(uploadError.message || "Failed to upload proof of payment.");
        }
        uploadedPaths.push(path);
        paymentsPayload.push({
          amountCollected: payment.amount,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          referenceNumber: payment.referenceNumber,
          notes: payment.notes,
          proofPath: path,
        });
      }

      const response = await encodeExistingPurchaseOrderAction({
        poNumber,
        clientId,
        subject,
        clientPoNumber,
        quotationReference,
        poDate,
        paymentTerms: paymentTermsSelect,
        paymentTermsCustom,
        leadTimeDays,
        hasUnequalMargins,
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          rawCost: item.rawCost,
          marginPercentage: item.marginPercentage,
          bankPercentage: item.bankPercentage,
          sopPercentage: item.sopPercentage,
        })),
        payments: paymentsPayload,
      });

      if (!response.success) {
        throw new Error(response.error ?? "Failed to record the purchase order.");
      }

      success(`Recorded purchase order ${poNumber}.`);
      closeDialog();
      router.refresh();
    } catch (err) {
      if (uploadedPaths.length > 0) {
        void supabase.storage.from(PROOF_OF_PAYMENT_BUCKET).remove(uploadedPaths);
      }
      error(err instanceof Error ? err.message : "Failed to record the purchase order.");
      setConfirmOpen(false);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else closeDialog();
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="outline" disabled={clients.length === 0}>
            Encode Existing PO
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-x-hidden md:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Encode Existing Purchase Order</DialogTitle>
            <DialogDescription>
              For POs that already exist and are already won -- this records them for the
              system without going through approval. Complete each step in order.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => goTo(v as StepId)}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
              {(Object.keys(STEP_LABELS) as StepId[]).map((step) => (
                <TabsTrigger
                  key={step}
                  value={step}
                  disabled={!unlocked[step]}
                  className="whitespace-normal text-xs"
                >
                  {STEP_LABELS[step]}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="details" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={`${formId}-po-number`}>PO Number</Label>
                  <Input
                    id={`${formId}-po-number`}
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value.toUpperCase())}
                    className="mt-1 uppercase"
                    placeholder="e.g. PO-2024-0087"
                  />
                </div>
                <div>
                  <Label htmlFor={`${formId}-po-date`}>PO Date</Label>
                  <Input
                    id={`${formId}-po-date`}
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor={`${formId}-client`}>Client</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger id={`${formId}-client`} className="mt-1">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor={`${formId}-subject`}>Subject</Label>
                  <Input
                    id={`${formId}-subject`}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1"
                    placeholder="Project scope or package"
                  />
                </div>
                <div>
                  <Label htmlFor={`${formId}-client-po`}>
                    Client PO Number (optional)
                  </Label>
                  <Input
                    id={`${formId}-client-po`}
                    value={clientPoNumber}
                    onChange={(e) => setClientPoNumber(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`${formId}-quotation-ref`}>Reference (optional)</Label>
                  <Input
                    id={`${formId}-quotation-ref`}
                    value={quotationReference}
                    onChange={(e) => setQuotationReference(e.target.value)}
                    className="mt-1"
                    placeholder="Internal project code, old quotation #, etc."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setItems((prev) => [...prev, emptyItemRow()])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Item
                  </Button>
                </div>
                <div className="mt-2 space-y-2">
                  {items.map((row, index) => (
                    <div key={row.key} className="flex items-start gap-2">
                      <Input
                        value={row.description}
                        onChange={(e) =>
                          updateItem(row.key, { description: e.target.value })
                        }
                        placeholder={`Item ${index + 1} description`}
                        className="min-w-0 flex-1"
                      />
                      <NumberInput
                        value={row.quantity}
                        onValueChange={(raw) => updateItem(row.key, { quantity: raw })}
                        placeholder="Qty"
                        className="w-16 shrink-0 sm:w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={items.length <= 1}
                        onClick={() => removeItem(row.key)}
                        aria-label={`Remove item ${index + 1}`}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => goTo("cost")} disabled={!step1Valid}>
                  Continue
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="cost" className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground">
                Enter each item&apos;s raw material + labor cost. Landed unit cost applies
                the standard +3% OPEX and +1.5% delivery fee automatically.
              </p>
              <ResponsiveTable
                table={
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Item</th>
                        <th className="py-1 pr-3 font-medium">Qty</th>
                        <th className="py-1 pr-3 font-medium">Raw Cost</th>
                        <th className="py-1 font-medium">Landed Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricedItems.map((item) => (
                        <tr key={item.key} className="border-t">
                          <td className="py-1 pr-3">{item.description || "—"}</td>
                          <td className="py-1 pr-3">{item.quantity}</td>
                          <td className="py-1 pr-3">
                            <NumberInput
                              value={item.rawCost}
                              onValueChange={(raw) =>
                                updateItem(item.key, { rawCost: raw })
                              }
                              className="h-7 w-28 text-xs"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="py-1">{formatCurrency(item.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                cards={pricedItems.map((item) => (
                  <DataCard
                    key={item.key}
                    header={
                      <p className="min-w-0 flex-1 font-medium">
                        {item.description || "—"}
                      </p>
                    }
                  >
                    <DataField label="Qty" value={item.quantity} />
                    <DataField
                      label="Raw Cost"
                      value={
                        <NumberInput
                          value={item.rawCost}
                          onValueChange={(raw) => updateItem(item.key, { rawCost: raw })}
                          className="ml-auto h-8 w-28 text-right text-xs"
                        />
                      }
                    />
                    <DataField
                      label="Landed Unit Cost"
                      value={formatCurrency(item.unitCost)}
                      className="border-t pt-1.5 font-semibold"
                    />
                  </DataCard>
                ))}
              />
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => goTo("details")}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => goTo("margins")}
                  disabled={!step2Valid}
                >
                  Continue
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="margins" className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${formId}-unequal-margins`}
                  checked={hasUnequalMargins}
                  onCheckedChange={(checked) => setHasUnequalMargins(checked === true)}
                />
                <Label htmlFor={`${formId}-unequal-margins`} className="cursor-pointer">
                  Unequal margins per item
                </Label>
              </div>

              {!hasUnequalMargins ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Margin %</Label>
                    <NumberInput
                      value={uniformMargin}
                      onValueChange={(v) => {
                        setUniformMargin(v);
                        applyUniformPercentage("marginPercentage", v);
                      }}
                      className="mt-1"
                      placeholder="e.g. 25"
                    />
                  </div>
                  <div>
                    <Label>Bank %</Label>
                    <NumberInput
                      value={uniformBank}
                      onValueChange={(v) => {
                        setUniformBank(v);
                        applyUniformPercentage("bankPercentage", v);
                      }}
                      className="mt-1"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <Label>SOP %</Label>
                    <NumberInput
                      value={uniformSop}
                      onValueChange={(v) => {
                        setUniformSop(v);
                        applyUniformPercentage("sopPercentage", v);
                      }}
                      className="mt-1"
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    Select items below, enter percentages here, then apply to stamp them
                    onto the selected rows.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <NumberInput
                      value={bulkMargin}
                      onValueChange={setBulkMargin}
                      placeholder="Margin %"
                    />
                    <NumberInput
                      value={bulkBank}
                      onValueChange={setBulkBank}
                      placeholder="Bank %"
                    />
                    <NumberInput
                      value={bulkSop}
                      onValueChange={setBulkSop}
                      placeholder="SOP %"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyBulkPercentages}
                    disabled={selectedItemKeys.size === 0}
                  >
                    Apply to selected ({selectedItemKeys.size})
                  </Button>
                </div>
              )}

              <ResponsiveTable
                table={
                  <table className="w-full min-w-[720px] whitespace-nowrap text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        {hasUnequalMargins ? <th className="w-6 py-1"></th> : null}
                        <th className="py-1 pr-3 font-medium">Item</th>
                        <th className="py-1 pr-3 font-medium">Direct Cost</th>
                        <th className="py-1 pr-3 font-medium">Margin %</th>
                        <th className="py-1 pr-3 font-medium">Bank %</th>
                        <th className="py-1 pr-3 font-medium">SOP %</th>
                        <th className="py-1 font-medium">Selling</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricedItems.map((item) => (
                        <tr key={item.key} className="border-t">
                          {hasUnequalMargins ? (
                            <td className="py-1">
                              <Checkbox
                                checked={selectedItemKeys.has(item.key)}
                                onCheckedChange={(checked) =>
                                  toggleItemSelected(item.key, checked === true)
                                }
                                aria-label={`Select ${item.description}`}
                              />
                            </td>
                          ) : null}
                          <td className="py-1 pr-3">{item.description || "—"}</td>
                          <td className="py-1 pr-3">{formatCurrency(item.directCost)}</td>
                          <td className="py-1 pr-3">
                            <NumberInput
                              value={item.marginPercentage}
                              onValueChange={(v) =>
                                updateItem(item.key, { marginPercentage: v })
                              }
                              disabled={!hasUnequalMargins}
                              className="h-7 w-20 text-xs"
                            />
                          </td>
                          <td className="py-1 pr-3">
                            <NumberInput
                              value={item.bankPercentage}
                              onValueChange={(v) =>
                                updateItem(item.key, { bankPercentage: v })
                              }
                              disabled={!hasUnequalMargins}
                              className="h-7 w-20 text-xs"
                            />
                          </td>
                          <td className="py-1 pr-3">
                            <NumberInput
                              value={item.sopPercentage}
                              onValueChange={(v) =>
                                updateItem(item.key, { sopPercentage: v })
                              }
                              disabled={!hasUnequalMargins}
                              className="h-7 w-20 text-xs"
                            />
                          </td>
                          <td className="py-1">{formatCurrency(item.sellingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                cards={pricedItems.map((item) => (
                  <DataCard
                    key={item.key}
                    header={
                      <div className="flex w-full items-start gap-2">
                        {hasUnequalMargins ? (
                          <Checkbox
                            checked={selectedItemKeys.has(item.key)}
                            onCheckedChange={(checked) =>
                              toggleItemSelected(item.key, checked === true)
                            }
                            aria-label={`Select ${item.description}`}
                            className="mt-0.5 shrink-0"
                          />
                        ) : null}
                        <p className="min-w-0 flex-1 font-medium">
                          {item.description || "—"}
                        </p>
                      </div>
                    }
                  >
                    <DataField
                      label="Direct Cost"
                      value={formatCurrency(item.directCost)}
                    />
                    <DataField
                      label="Margin %"
                      value={
                        <NumberInput
                          value={item.marginPercentage}
                          onValueChange={(v) =>
                            updateItem(item.key, { marginPercentage: v })
                          }
                          disabled={!hasUnequalMargins}
                          className="ml-auto h-8 w-24 text-right text-xs"
                        />
                      }
                    />
                    <DataField
                      label="Bank %"
                      value={
                        <NumberInput
                          value={item.bankPercentage}
                          onValueChange={(v) =>
                            updateItem(item.key, { bankPercentage: v })
                          }
                          disabled={!hasUnequalMargins}
                          className="ml-auto h-8 w-24 text-right text-xs"
                        />
                      }
                    />
                    <DataField
                      label="SOP %"
                      value={
                        <NumberInput
                          value={item.sopPercentage}
                          onValueChange={(v) =>
                            updateItem(item.key, { sopPercentage: v })
                          }
                          disabled={!hasUnequalMargins}
                          className="ml-auto h-8 w-24 text-right text-xs"
                        />
                      }
                    />
                    <DataField
                      label="Selling"
                      value={formatCurrency(item.sellingAmount)}
                      className="border-t pt-1.5 font-semibold"
                    />
                  </DataCard>
                ))}
              />

              <PricingBreakdown
                directCost={pricing.directCost}
                marginAmount={pricing.marginAmount}
                bankAmount={pricing.bankAmount}
                sopAmount={pricing.sopAmount}
                sellingAmount={pricing.sellingAmount}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${formId}-lead-time`}>Lead Time (days)</Label>
                  <Input
                    id={`${formId}-lead-time`}
                    type="number"
                    min={0}
                    step="1"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    className="mt-1"
                    placeholder="e.g. 30"
                  />
                </div>
                <div>
                  <Label htmlFor={`${formId}-payment-terms`}>Payment Terms</Label>
                  <Select
                    value={paymentTermsSelect || undefined}
                    onValueChange={setPaymentTermsSelect}
                  >
                    <SelectTrigger id={`${formId}-payment-terms`} className="mt-1">
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
                  <Label htmlFor={`${formId}-payment-terms-custom`}>
                    Custom Payment Terms
                  </Label>
                  <Input
                    id={`${formId}-payment-terms-custom`}
                    value={paymentTermsCustom}
                    onChange={(e) => setPaymentTermsCustom(e.target.value)}
                    className="mt-1"
                    placeholder="Describe the agreed payment terms"
                  />
                </div>
              ) : null}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => goTo("cost")}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => goTo("review")}
                  disabled={!step3Valid}
                >
                  Continue
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="review" className="space-y-4 pt-4">
              <dl className="grid grid-cols-1 gap-2 rounded-md border bg-muted/20 p-4 text-sm sm:grid-cols-[160px_1fr]">
                <dt className="text-muted-foreground">PO Number</dt>
                <dd className="font-medium">{poNumber || "—"}</dd>
                <dt className="text-muted-foreground">Client</dt>
                <dd className="font-medium">{clientName}</dd>
                <dt className="text-muted-foreground">Subject</dt>
                <dd className="font-medium">{subject || "—"}</dd>
                <dt className="text-muted-foreground">PO Date</dt>
                <dd className="font-medium">{poDate}</dd>
                <dt className="text-muted-foreground">Payment Terms</dt>
                <dd className="font-medium">{paymentTermsResolved || "—"}</dd>
                <dt className="text-muted-foreground">Lead Time</dt>
                <dd className="font-medium">{leadTimeDays || "—"} days</dd>
              </dl>

              <ResponsiveTable
                table={
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Item</th>
                        <th className="py-1 pr-3 font-medium">Qty</th>
                        <th className="py-1 pr-3 font-medium">Raw Cost</th>
                        <th className="py-1 pr-3 font-medium">Margin %</th>
                        <th className="py-1 font-medium">Selling</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricedItems.map((item) => (
                        <tr key={item.key} className="border-t">
                          <td className="py-1 pr-3">{item.description}</td>
                          <td className="py-1 pr-3">{item.quantity}</td>
                          <td className="py-1 pr-3">
                            {formatCurrency(Number(item.rawCost) || 0)}
                          </td>
                          <td className="py-1 pr-3">{item.marginPercentage}%</td>
                          <td className="py-1">{formatCurrency(item.sellingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                cards={pricedItems.map((item) => (
                  <DataCard
                    key={item.key}
                    header={<p className="font-medium">{item.description}</p>}
                  >
                    <DataField label="Qty" value={item.quantity} />
                    <DataField
                      label="Raw Cost"
                      value={formatCurrency(Number(item.rawCost) || 0)}
                    />
                    <DataField label="Margin %" value={`${item.marginPercentage}%`} />
                    <DataField
                      label="Selling"
                      value={formatCurrency(item.sellingAmount)}
                      className="border-t pt-1.5 font-semibold"
                    />
                  </DataCard>
                ))}
              />

              <PricingBreakdown
                directCost={pricing.directCost}
                marginAmount={pricing.marginAmount}
                bankAmount={pricing.bankAmount}
                sopAmount={pricing.sopAmount}
                sellingAmount={pricing.sellingAmount}
              />

              <Callout tone="muted">
                This creates the PO as already approved, with no approval workflow. It
                can&apos;t be edited afterward, only deleted and re-encoded if a mistake
                was made.
              </Callout>

              <div className="flex flex-wrap justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => goTo("margins")}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => goTo("payments")}
                  >
                    Add Historical Payments
                  </Button>
                  <Button type="button" onClick={() => setConfirmOpen(true)}>
                    Record Existing PO
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground">
                Optional. Add any payments already collected against this PO before it
                entered the system. Each payment needs a proof-of-payment photo.
              </p>

              <div className="space-y-4">
                {payments.map((payment, index) => (
                  <div key={payment.key} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Payment {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaymentRow(payment.key)}
                        aria-label={`Remove payment ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Amount</Label>
                        <NumberInput
                          value={payment.amount}
                          onValueChange={(v) => updatePayment(payment.key, { amount: v })}
                          className="mt-1"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Payment Date</Label>
                        <Input
                          type="date"
                          value={payment.paymentDate}
                          onChange={(e) =>
                            updatePayment(payment.key, { paymentDate: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Method (optional)</Label>
                        <Input
                          value={payment.paymentMethod}
                          onChange={(e) =>
                            updatePayment(payment.key, { paymentMethod: e.target.value })
                          }
                          className="mt-1"
                          placeholder="e.g. Bank transfer"
                        />
                      </div>
                      <div>
                        <Label>Reference # (optional)</Label>
                        <Input
                          value={payment.referenceNumber}
                          onChange={(e) =>
                            updatePayment(payment.key, {
                              referenceNumber: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <ProofOfPaymentField
                      id={`${formId}-payment-proof-${payment.key}`}
                      label="Proof of Payment (required)"
                      value={payment.proofFile}
                      onChange={(file) => updatePayment(payment.key, { proofFile: file })}
                      onError={(message) => error(message)}
                    />
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addPaymentRow}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Payment
              </Button>

              {payments.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Total entered: {formatCurrency(totalPayments)} of{" "}
                  {formatCurrency(pricing.sellingAmount)}
                </p>
              ) : null}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => goTo("review")}>
                  Back
                </Button>
                <Button type="button" onClick={() => setConfirmOpen(true)}>
                  Record Existing PO
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-2">
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Record this existing purchase order?"
        description={`This permanently records ${poNumber || "this PO"} as an approved purchase order for ${clientName}, totaling ${formatCurrency(pricing.sellingAmount)} across ${items.length} item(s)${payments.length > 0 ? ` and ${payments.length} payment(s)` : ""}. It will not go through approval. This can only be undone by deleting the record.`}
        confirmLabel="Yes, Record It"
        busyLabel="Recording..."
        isBusy={isSubmitting}
        onConfirm={handleConfirmSubmit}
      />
    </>
  );
}
