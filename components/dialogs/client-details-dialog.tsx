"use client";

import { updateClientAction } from "@/app/protected/sales/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SalesClient } from "@/lib/sales/clients";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ClientDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: SalesClient | null;
  startInEditMode?: boolean;
};

type ClientFormValues = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  sector: "commercial" | "industrial" | "solar";
};

function toFormValues(client: SalesClient): ClientFormValues {
  return {
    name: client.companyName,
    contactPerson: client.contactPerson ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    sector: client.sector,
  };
}

export function ClientDetailsDialog({
  open,
  onOpenChange,
  client,
  startInEditMode = false,
}: ClientDetailsDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formValues, setFormValues] = useState<ClientFormValues>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    sector: "commercial",
  });

  useEffect(() => {
    if (!open || !client) {
      return;
    }

    setFormValues(toFormValues(client));
    setIsEditing(startInEditMode);
    setFormError(null);
    setFieldErrors({});
  }, [open, client, startInEditMode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || !client) {
    return null;
  }

  const handleEditCancel = () => {
    setFormValues(toFormValues(client));
    setFormError(null);
    setFieldErrors({});
    setIsEditing(false);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData();
    formData.set("id", client.id);
    formData.set("name", formValues.name);
    formData.set("contactPerson", formValues.contactPerson);
    formData.set("email", formValues.email);
    formData.set("phone", formValues.phone);
    formData.set("address", formValues.address);
    formData.set("sector", formValues.sector);
    formData.set("paymentTermsDays", String(client.paymentTermsDays));

    const response = await updateClientAction(formData);

    if (!response.success) {
      const message = response.error ?? "Failed to update client.";
      setFormError(message);
      setFieldErrors((response.fieldErrors as Record<string, string>) ?? {});
      error(message);
      setIsSaving(false);
      return;
    }

    success("Client updated successfully.");
    setIsSaving(false);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-details-title"
        className="w-full max-w-xl rounded-lg border bg-card p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="client-details-title" className="text-xl font-semibold">
              Client Details
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditing ? "Update client information and save your changes." : "Read-only profile information."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                Edit Client
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close client details dialog">
              Close
            </Button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="grid gap-4">
            <div>
              <Label htmlFor="client-code">Code</Label>
              <Input id="client-code" value={client.clientCode} readOnly className="mt-1" />
            </div>

            <div>
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, name: event.target.value }))
                }
                className="mt-1"
              />
              {fieldErrors.name ? <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="client-contact-person">Contact</Label>
                <Input
                  id="client-contact-person"
                  value={formValues.contactPerson}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, contactPerson: event.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="client-sector">Sector</Label>
                <select
                  id="client-sector"
                  value={formValues.sector}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      sector: event.target.value as ClientFormValues["sector"],
                    }))
                  }
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="solar">Solar</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={formValues.email}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, email: event.target.value }))
                  }
                  className="mt-1"
                />
                {fieldErrors.email ? <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p> : null}
              </div>
              <div>
                <Label htmlFor="client-phone">Phone</Label>
                <Input
                  id="client-phone"
                  value={formValues.phone}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, phone: event.target.value }))
                  }
                  className="mt-1"
                />
                {fieldErrors.phone ? <p className="mt-1 text-xs text-destructive">{fieldErrors.phone}</p> : null}
              </div>
            </div>

            <div>
              <Label htmlFor="client-address">Address</Label>
              <Input
                id="client-address"
                value={formValues.address}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, address: event.target.value }))
                }
                className="mt-1"
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleEditCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Code</dt>
              <dd className="font-medium">{client.clientCode}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{client.companyName}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Sector</dt>
              <dd className="capitalize">{client.sector}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Contact</dt>
              <dd>{client.contactPerson ?? "Not provided"}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{client.email ?? "Not provided"}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{client.phone ?? "Not provided"}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Address</dt>
              <dd>{client.address ?? "Not provided"}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(client.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
