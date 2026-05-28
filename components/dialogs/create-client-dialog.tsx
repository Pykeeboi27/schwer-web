"use client";

import { createClientAction } from "@/app/protected/sales/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateClientCode } from "@/lib/utils/client-code-generator";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type CreateClientDialogProps = {
  onCreated?: () => void;
  existingNames?: string[];
};

function formatTin(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)];
  return parts.filter(Boolean).join("-");
}

export function CreateClientDialog({ onCreated, existingNames = [] }: CreateClientDialogProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientCode, setClientCode] = useState(generateClientCode());
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tin, setTin] = useState("");
  const [nameDupError, setNameDupError] = useState<string | null>(null);
  const [birUploading, setBirUploading] = useState(false);
  const [birUploadedName, setBirUploadedName] = useState<string | null>(null);
  const [birNotConfigured, setBirNotConfigured] = useState(false);
  const [birLinkFallback, setBirLinkFallback] = useState("");
  const birLinkRef = useRef<HTMLInputElement>(null);

  const dialogTitleId = useMemo(() => "create-client-dialog-title", []);

  const closeDialog = () => {
    setOpen(false);
    setFormError(null);
    setFieldErrors({});
    setTin("");
    setNameDupError(null);
    setBirUploading(false);
    setBirUploadedName(null);
    setBirNotConfigured(false);
    setBirLinkFallback("");
  };

  const openDialog = () => {
    setClientCode(generateClientCode());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleGenerateCode = () => {
    setClientCode(generateClientCode());
  };

  const checkDuplicateName = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    const isDup = existingNames.some((n) => n.trim().toLowerCase() === normalized);
    setNameDupError(isDup ? "A client with this name already exists." : null);
  };

  const handleBirFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBirUploading(true);
    setBirUploadedName(null);
    setBirNotConfigured(false);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/drive-upload", { method: "POST", body: fd });
      if (res.status === 503) {
        setBirNotConfigured(true);
        setBirUploading(false);
        return;
      }
      if (!res.ok) {
        error("File upload failed. Please try again.");
        setBirUploading(false);
        return;
      }
      const data = (await res.json()) as { webViewLink: string };
      if (birLinkRef.current) birLinkRef.current.value = data.webViewLink;
      setBirUploadedName(file.name);
    } catch {
      error("Upload failed. Check your connection.");
    } finally {
      setBirUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const nameInput = (event.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value ?? "";
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
    if (birLinkRef.current?.value) {
      formData.set("birRegistrationLink", birLinkRef.current.value);
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

              <div>
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

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  required
                  className="mt-1"
                  placeholder="0917-555-1234"
                />
                {fieldErrors.phone ? (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.phone}</p>
                ) : null}
              </div>

              <div className="md:col-span-2">
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

              <div>
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

              <div>
                <Label htmlFor="birDocument">BIR Registration</Label>
                {birUploadedName ? (
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <a
                      href={birLinkRef.current?.value}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {birUploadedName}
                    </a>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => {
                        setBirUploadedName(null);
                        if (birLinkRef.current) birLinkRef.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : birNotConfigured ? (
                  <>
                    <Input
                      id="birRegistrationLink"
                      name="birRegistrationLink"
                      type="url"
                      className="mt-1"
                      placeholder="https://drive.google.com/..."
                      value={birLinkFallback}
                      onChange={(e) => setBirLinkFallback(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Drive upload not configured — paste the link manually.
                    </p>
                  </>
                ) : (
                  <div className="mt-1">
                    <input
                      id="birDocument"
                      type="file"
                      accept="application/pdf,image/*"
                      className="w-full text-sm"
                      disabled={birUploading}
                      onChange={handleBirFileChange}
                    />
                    {birUploading ? (
                      <p className="mt-1 text-xs text-muted-foreground">Uploading...</p>
                    ) : null}
                  </div>
                )}
                <input type="hidden" name="birRegistrationLink" ref={birLinkRef} />
              </div>

              {formError ? (
                <p className="md:col-span-2 text-sm text-destructive">{formError}</p>
              ) : null}

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !!nameDupError}>
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
