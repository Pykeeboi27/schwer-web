"use client";

import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";

type ProofOfPaymentFieldProps = {
  id: string;
  label: string;
  /** Compressed file staged for upload, or null if none chosen yet. */
  value: File | null;
  onChange: (file: File | null) => void;
  /** Signed URL of the proof already attached (edit mode), if any. */
  existingPreviewUrl?: string | null;
  disabled?: boolean;
  onError?: (message: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/webp",
};

/**
 * Controlled proof-of-payment image field. Unlike DriveUploadField, this
 * does NOT upload on selection -- it compresses the chosen image client-side
 * (via browser-image-compression) and holds the resulting File in state so
 * the parent dialog can upload it to Supabase Storage only on submit. That
 * avoids orphaned storage objects if the dialog is cancelled after a file is
 * picked.
 */
export function ProofOfPaymentField({
  id,
  label,
  value,
  onChange,
  existingPreviewUrl = null,
  disabled = false,
  onError,
  ...aria
}: ProofOfPaymentFieldProps) {
  const [compressing, setCompressing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the local object-URL preview in sync with the staged file, and
  // revoke it on change/unmount to avoid leaking blob URLs.
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Always clear the raw <input> so choosing the same filename again still
    // fires onChange.
    event.target.value = "";
    if (!file) return;

    setCompressing(true);
    try {
      const imageCompression = (await import("browser-image-compression")).default;
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      onChange(compressed);
    } catch {
      onError?.("Could not process that image. Please try a different photo.");
    } finally {
      setCompressing(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  const displayUrl = previewUrl ?? (!value ? existingPreviewUrl : null);
  const statusLabel = value
    ? "New photo selected"
    : existingPreviewUrl
      ? "Current proof of payment"
      : null;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>

      {displayUrl ? (
        <div className="mt-1 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/signed URL preview, not a static asset */}
          <img
            src={displayUrl}
            alt="Proof of payment preview"
            className="h-40 w-auto max-w-full rounded-md border object-contain"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{statusLabel}</span>
            {value ? (
              <button
                type="button"
                className="text-destructive underline"
                onClick={handleRemove}
                disabled={disabled}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                className="text-primary underline"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || compressing}
              >
                Replace
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-1">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/*"
            capture="environment"
            className="w-full text-sm"
            disabled={disabled || compressing}
            onChange={handleFileChange}
            {...aria}
          />
          {compressing ? (
            <p className="mt-1 text-xs text-muted-foreground">Compressing photo...</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
