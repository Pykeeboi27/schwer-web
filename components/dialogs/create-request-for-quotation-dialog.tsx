"use client";

import { createRequestForQuotationAction } from "@/app/protected/sales/request-for-quotation/actions";
import { Button } from "@/components/ui/button";
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
import { textareaClassName } from "@/components/patterns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { suggestQuotationNumber } from "@/lib/engineering/suggest-quotation-number";
import { useToast } from "@/lib/utils/toast-notification";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ClientOption = {
  id: string;
  companyName: string;
};

type ItemRow = {
  description: string;
  quantity: string;
};

type CreateRequestForQuotationDialogProps = {
  clients: ClientOption[];
};

function emptyRow(): ItemRow {
  return { description: "", quantity: "1" };
}

export function CreateRequestForQuotationDialog({
  clients,
}: CreateRequestForQuotationDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [quotationNumber, setQuotationNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);

  const closeDialog = () => {
    setOpen(false);
    setIsSubmitting(false);
    setFormError(null);
    setQuotationNumber("");
    setClientId("");
    setSubject("");
    setNotes("");
    setItems([emptyRow()]);
  };

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const quotationNumberValue = quotationNumber.trim().toUpperCase();
    if (!quotationNumberValue) {
      const message = "Quotation ID is required.";
      setFormError(message);
      error(message);
      return;
    }

    if (!clientId) {
      const message = "Client is required.";
      setFormError(message);
      error(message);
      return;
    }

    if (!subject.trim()) {
      const message = "Subject is required.";
      setFormError(message);
      error(message);
      return;
    }

    const parsedItems = items
      .map((row) => ({
        // Quotation line items are standardized to ALL CAPS.
        description: row.description.trim().toUpperCase(),
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.description !== "");

    if (parsedItems.length === 0) {
      const message = "Add at least one line item with a description.";
      setFormError(message);
      error(message);
      return;
    }

    const invalidQuantity = parsedItems.find(
      (row) => !Number.isFinite(row.quantity) || row.quantity <= 0,
    );
    if (invalidQuantity) {
      const message = "Every item needs a quantity greater than 0.";
      setFormError(message);
      error(message);
      return;
    }

    setIsSubmitting(true);
    const response = await createRequestForQuotationAction({
      quotationNumber: quotationNumberValue,
      clientId,
      // Quotation subject and comments are standardized to ALL CAPS.
      subject: subject.trim().toUpperCase(),
      notes: notes.trim() ? notes.trim().toUpperCase() : null,
      items: parsedItems,
    });

    if (!response.success) {
      const message = response.error ?? "Failed to create the request for quotation.";
      setFormError(message);
      error(message);
      setIsSubmitting(false);
      return;
    }

    success("Request for quotation created.");
    closeDialog();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else closeDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" disabled={clients.length === 0}>
          Request for Quotation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Request for Quotation</DialogTitle>
          <DialogDescription>
            List the items and quantities Engineering needs to cost. You&apos;ll set
            pricing once the costing comes back approved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="rfq-number">Quotation ID</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="rfq-number"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value.toUpperCase())}
                  className="uppercase"
                  placeholder="QT-2026-001"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuotationNumber(suggestQuotationNumber())}
                >
                  Suggest
                </Button>
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="rfq-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="rfq-client" className="mt-1">
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
              <Label htmlFor="rfq-subject">Subject</Label>
              <Input
                id="rfq-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
                placeholder="Project scope or package"
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
                onClick={() => setItems((prev) => [...prev, emptyRow()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            <div className="mt-2 space-y-2">
              {items.map((row, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input
                    value={row.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder={`Item ${index + 1} description`}
                    className="min-w-0 flex-1"
                  />
                  <NumberInput
                    value={row.quantity}
                    onValueChange={(raw) => updateItem(index, { quantity: raw })}
                    placeholder="Qty"
                    className="w-16 shrink-0 sm:w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={items.length <= 1}
                    onClick={() => removeItem(index)}
                    aria-label={`Remove item ${index + 1}`}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="rfq-notes">Comments</Label>
            <textarea
              id="rfq-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={textareaClassName}
              placeholder="Add any commercial notes or comments (optional)"
            />
          </div>

          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Create Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
