"use client";

import { createClientAction } from "@/app/protected/sales/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateClientCode } from "@/lib/utils/client-code-generator";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CreateClientDialogProps = {
  onCreated?: () => void;
};

export function CreateClientDialog({ onCreated }: CreateClientDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientCode, setClientCode] = useState(generateClientCode());
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const dialogTitleId = useMemo(() => "create-client-dialog-title", []);

  const closeDialog = () => {
    setOpen(false);
    setFormError(null);
    setFieldErrors({});
  };

  const openDialog = () => {
    setClientCode(generateClientCode());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setFormError(null);
        setFieldErrors({});
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleGenerateCode = () => {
    setClientCode(generateClientCode());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    formData.set("code", clientCode);

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
    <>
      <Button onClick={openDialog}>Create Client</Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id={dialogTitleId} className="text-xl font-semibold">
                  Create Client
                </h2>
                <p className="text-sm text-muted-foreground">
                  Fill out client details and generate a unique client code.
                </p>
              </div>
              <Button variant="ghost" onClick={closeDialog} aria-label="Close create client dialog">
                Close
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
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
                <Input id="name" name="name" required className="mt-1" placeholder="Schwer Trading" />
                {fieldErrors.name ? <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p> : null}
              </div>

              <div>
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input id="contactPerson" name="contactPerson" className="mt-1" placeholder="Juan Dela Cruz" />
              </div>

              <div>
                <Label htmlFor="sector">Sector</Label>
                <select
                  id="sector"
                  name="sector"
                  defaultValue="commercial"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="solar">Solar</option>
                </select>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" className="mt-1" placeholder="client@example.com" />
                {fieldErrors.email ? <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p> : null}
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" className="mt-1" placeholder="0917-555-1234" />
                {fieldErrors.phone ? <p className="mt-1 text-xs text-destructive">{fieldErrors.phone}</p> : null}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" className="mt-1" placeholder="City, Province" />
              </div>

              {formError ? <p className="md:col-span-2 text-sm text-destructive">{formError}</p> : null}

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Create Client"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
