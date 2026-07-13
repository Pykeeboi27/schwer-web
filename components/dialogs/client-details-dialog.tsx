"use client";

import { updateClientAction } from "@/app/protected/sales/clients/actions";
import {
  addClientContactAction,
  fetchClientContactsAction,
  setPrimaryContactAction,
} from "@/app/protected/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { selectFieldClassName } from "@/components/patterns";
import type { SalesClient, SalesClientContact } from "@/lib/sales/clients";
import { useToast } from "@/lib/utils/toast-notification";
import { cn } from "@/lib/utils";
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
  tin: string;
  birRegistrationLink: string;
  sector: "commercial" | "industrial" | "solar";
};

function toFormValues(client: SalesClient): ClientFormValues {
  return {
    name: client.companyName,
    contactPerson: client.contactPerson ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    tin: client.tin ?? "",
    birRegistrationLink: client.birRegistrationLink ?? "",
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
    tin: "",
    birRegistrationLink: "",
    sector: "commercial",
  });

  const [contacts, setContacts] = useState<SalesClientContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactFormError, setContactFormError] = useState<string | null>(null);
  const [updatingPrimaryId, setUpdatingPrimaryId] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    fullName: "",
    position: "",
    phone: "",
    mobile: "",
    email: "",
    isPrimary: false,
  });

  useEffect(() => {
    if (!open || !client) {
      return;
    }

    setFormValues(toFormValues(client));
    setIsEditing(startInEditMode);
    setFormError(null);
    setFieldErrors({});
    setNewContact({
      fullName: "",
      position: "",
      phone: "",
      mobile: "",
      email: "",
      isPrimary: false,
    });
    setContactFormError(null);
  }, [open, client, startInEditMode]);

  useEffect(() => {
    if (!open || !client) {
      return;
    }

    let cancelled = false;
    setContactsLoading(true);

    fetchClientContactsAction(client.id).then((response) => {
      if (cancelled) return;
      setContacts(response.data);
      setContactsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, client]);

  if (!client) {
    return null;
  }

  const reloadContacts = async () => {
    const response = await fetchClientContactsAction(client.id);
    setContacts(response.data);
  };

  const handleAddContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactFormError(null);

    if (!newContact.fullName.trim()) {
      setContactFormError("Contact name is required.");
      return;
    }

    setIsAddingContact(true);

    const formData = new FormData();
    formData.set("clientId", client.id);
    formData.set("fullName", newContact.fullName.trim());
    formData.set("position", newContact.position.trim());
    formData.set("phone", newContact.phone.trim());
    formData.set("mobile", newContact.mobile.trim());
    formData.set("email", newContact.email.trim());
    if (newContact.isPrimary) {
      formData.set("isPrimary", "on");
    }

    const response = await addClientContactAction(formData);

    if (!response.ok) {
      const message = response.error ?? "Failed to add contact.";
      setContactFormError(message);
      error(message);
      setIsAddingContact(false);
      return;
    }

    success("Contact added.");
    setNewContact({
      fullName: "",
      position: "",
      phone: "",
      mobile: "",
      email: "",
      isPrimary: false,
    });
    await reloadContacts();
    setIsAddingContact(false);
  };

  const handleMakePrimary = async (contactId: string) => {
    setUpdatingPrimaryId(contactId);
    const formData = new FormData();
    formData.set("clientId", client.id);
    formData.set("contactId", contactId);

    const response = await setPrimaryContactAction(formData);

    if (!response.ok) {
      error(response.error ?? "Failed to set primary contact.");
      setUpdatingPrimaryId(null);
      return;
    }

    success("Primary contact updated.");
    await reloadContacts();
    setUpdatingPrimaryId(null);
  };

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
    formData.set("tin", formValues.tin);
    formData.set("birRegistrationLink", formValues.birRegistrationLink);
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Details</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update client information and save your changes."
              : "Read-only profile information."}
          </DialogDescription>
        </DialogHeader>

        {!isEditing ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Edit Client
            </Button>
          </div>
        ) : null}

        {isEditing ? (
          <form onSubmit={handleSave} className="grid gap-4">
            <div>
              <Label htmlFor="client-code">Code</Label>
              <Input
                id="client-code"
                value={client.clientCode}
                readOnly
                className="mt-1"
              />
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
              {fieldErrors.name ? (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="client-contact-person">Contact (notes)</Label>
                <Input
                  id="client-contact-person"
                  value={formValues.contactPerson}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      contactPerson: event.target.value,
                    }))
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
                  className={cn(selectFieldClassName, "mt-1 h-9 py-1")}
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
                    setFormValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="client-phone">Phone</Label>
                <Input
                  id="client-phone"
                  value={formValues.phone}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
                {fieldErrors.phone ? (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.phone}</p>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="client-address">Address</Label>
              <Input
                id="client-address"
                value={formValues.address}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="client-tin">TIN</Label>
                <Input
                  id="client-tin"
                  value={formValues.tin}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, tin: event.target.value }))
                  }
                  className="mt-1"
                  placeholder="000-000-000-000"
                />
              </div>
              <div>
                <Label htmlFor="client-bir">BIR Registration Link</Label>
                <Input
                  id="client-bir"
                  type="url"
                  value={formValues.birRegistrationLink}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      birRegistrationLink: event.target.value,
                    }))
                  }
                  className="mt-1"
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              <dt className="text-muted-foreground">Contact (notes)</dt>
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
              <dt className="text-muted-foreground">TIN</dt>
              <dd>{client.tin ?? "Not provided"}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">BIR Registration</dt>
              <dd>
                {client.birRegistrationLink ? (
                  <a
                    href={client.birRegistrationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 break-all"
                  >
                    View document
                  </a>
                ) : (
                  "Not provided"
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(client.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        )}

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold">Contacts</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The primary contact here is what appears on the PO worksheet — the
            &ldquo;Contact (notes)&rdquo; field above does not.
          </p>

          {contactsLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.fullName}</span>
                      {contact.isPrimary ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    {contact.position ? (
                      <p className="text-muted-foreground">{contact.position}</p>
                    ) : null}
                    <p className="text-muted-foreground">
                      {[contact.mobile, contact.phone, contact.email]
                        .filter(Boolean)
                        .join(" · ") || "No contact details"}
                    </p>
                  </div>
                  {!contact.isPrimary ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updatingPrimaryId === contact.id}
                      onClick={() => handleMakePrimary(contact.id)}
                    >
                      {updatingPrimaryId === contact.id ? "Saving..." : "Make Primary"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddContact} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="new-contact-name">Contact Name</Label>
                <Input
                  id="new-contact-name"
                  value={newContact.fullName}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  className="mt-1"
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label htmlFor="new-contact-position">Position</Label>
                <Input
                  id="new-contact-position"
                  value={newContact.position}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      position: event.target.value,
                    }))
                  }
                  className="mt-1"
                  placeholder="e.g. Purchasing Manager"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="new-contact-mobile">Mobile</Label>
                <Input
                  id="new-contact-mobile"
                  value={newContact.mobile}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      mobile: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-contact-phone">Phone</Label>
                <Input
                  id="new-contact-phone"
                  value={newContact.phone}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-contact-email">Email</Label>
                <Input
                  id="new-contact-email"
                  type="email"
                  value={newContact.email}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newContact.isPrimary}
                onChange={(event) =>
                  setNewContact((current) => ({
                    ...current,
                    isPrimary: event.target.checked,
                  }))
                }
              />
              Set as primary contact
            </label>

            {contactFormError ? (
              <p className="text-sm text-destructive">{contactFormError}</p>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={isAddingContact}>
                {isAddingContact ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
