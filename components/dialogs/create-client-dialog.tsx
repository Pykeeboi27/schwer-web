"use client";

import { createClientAction } from "@/app/protected/sales/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DriveUploadField } from "@/components/dialogs/drive-upload-field";
import { cn } from "@/lib/utils";
import { generateClientCode } from "@/lib/utils/client-code-generator";
import { sanitizePhoneInput } from "@/lib/utils/form-validation";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CreateClientDialogProps = {
  onCreated?: () => void;
  existingNames?: string[];
};

function formatTin(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 14),
  ];
  return parts.filter(Boolean).join("-");
}

export function CreateClientDialog({
  onCreated,
  existingNames = [],
}: CreateClientDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientCode, setClientCode] = useState(generateClientCode());
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tin, setTin] = useState("");
  const [nameDupError, setNameDupError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [birRegistrationLink, setBirRegistrationLink] = useState("");

  const closeDialog = () => {
    setOpen(false);
    setFormError(null);
    setFieldErrors({});
    setTin("");
    setNameDupError(null);
    setPhone("");
    setBirRegistrationLink("");
  };

  const openDialog = () => {
    setClientCode(generateClientCode());
    setOpen(true);
  };

  const handleGenerateCode = () => {
    setClientCode(generateClientCode());
  };

  const checkDuplicateName = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    const isDup = existingNames.some((n) => n.trim().toLowerCase() === normalized);
    setNameDupError(isDup ? "A client with this name already exists." : null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const nameInput =
      (event.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value ?? "";
    const dupNormalized = nameInput.trim().toLowerCase();
    const isDup = existingNames.some((n) => n.trim().toLowerCase() === dupNormalized);
    if (isDup) {
      setNameDupError("A client with this name already exists.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("code", clientCode);
    formData.set("tin", tin);
    formData.set("phone", phone);
    if (birRegistrationLink) {
      formData.set("birRegistrationLink", birRegistrationLink);
    }

    const response = await createClientAction(formData);

    if (!response.success) {
      setFormError(response.error ?? "Failed to create client.");
      setFieldErrors((response.fieldErrors as Record<string, string>) ?? {});
      error(response.error ?? "Failed to create client.");
      setIsSubmitting(false);
      return;
    }

    success("Client created successfully.");
    closeDialog();
    onCreated?.();
    router.refresh();
    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) openDialog();
        else closeDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button>Create Client</Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
        )}
      >
        <DialogHeader>
          <DialogTitle>Create Client</DialogTitle>
          <DialogDescription>
            Fill out client details and generate a unique client code.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="code">Client Code</Label>
            <div className="mt-1 flex gap-2">
              <Input id="code" value={clientCode} readOnly />
              <Button type="button" variant="outline" onClick={handleGenerateCode}>
                Generate Code
              </Button>
            </div>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="name">Client Name</Label>
            <Input
              id="name"
              name="name"
              required
              className="mt-1"
              placeholder="Schwer Trading"
              onBlur={(e) => checkDuplicateName(e.target.value)}
              onChange={() => setNameDupError(null)}
            />
            {nameDupError ? (
              <p className="mt-1 text-xs text-destructive">{nameDupError}</p>
            ) : fieldErrors.name ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="min-w-0">
            <Label htmlFor="contactPerson">Contact Person</Label>
            <Input
              id="contactPerson"
              name="contactPerson"
              required
              className="mt-1"
              placeholder="Juan Dela Cruz"
            />
            {fieldErrors.contactPerson ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.contactPerson}</p>
            ) : null}
          </div>

          <div className="min-w-0">
            <Label htmlFor="sector">Sector</Label>
            <Select name="sector" defaultValue="commercial">
              <SelectTrigger id="sector" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
                <SelectItem value="solar">Solar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1"
              placeholder="client@example.com"
            />
            {fieldErrors.email ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="min-w-0">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              required
              className="mt-1"
              placeholder="0917-555-1234"
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              inputMode="tel"
            />
            {fieldErrors.phone ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.phone}</p>
            ) : null}
          </div>

          <div className="min-w-0 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              name="address"
              required
              className="mt-1"
              placeholder="City, Province"
            />
            {fieldErrors.address ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.address}</p>
            ) : null}
          </div>

          <div className="min-w-0">
            <Label htmlFor="tin">TIN</Label>
            <Input
              id="tin"
              name="tin"
              required
              className="mt-1"
              placeholder="000-000-000-00000"
              value={tin}
              onChange={(e) => setTin(formatTin(e.target.value))}
              inputMode="numeric"
            />
            {fieldErrors.tin ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.tin}</p>
            ) : null}
          </div>

          <div className="min-w-0">
            <DriveUploadField
              id="birDocument"
              label="BIR Registration"
              value={birRegistrationLink}
              onChange={setBirRegistrationLink}
              onError={error}
            />
          </div>

          {formError ? (
            <p className="md:col-span-2 text-sm text-destructive">{formError}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !!nameDupError}>
              {isSubmitting ? "Saving..." : "Create Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
