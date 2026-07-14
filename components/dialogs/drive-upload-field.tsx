"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type DriveUploadFieldProps = {
  id: string;
  label: string;
  /** Current Drive link (or manually-pasted URL). */
  value: string;
  onChange: (link: string) => void;
  accept?: string;
  onError?: (message: string) => void;
};

/**
 * Controlled file-upload field backed by /api/drive-upload. Uploads a file to
 * Google Drive and reports the resulting webViewLink via onChange. Falls back
 * to a manual URL input when Drive isn't configured (503) — mirrors the
 * BIR-registration upload originally built inline in CreateClientDialog.
 */
export function DriveUploadField({
  id,
  label,
  value,
  onChange,
  accept = "application/pdf,image/*",
  onError,
}: DriveUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadedName(null);
    setNotConfigured(false);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/drive-upload", { method: "POST", body: fd });
      if (res.status === 503) {
        setNotConfigured(true);
        setUploading(false);
        return;
      }
      if (!res.ok) {
        onError?.("File upload failed. Please try again.");
        setUploading(false);
        return;
      }
      const data = (await res.json()) as { webViewLink: string };
      onChange(data.webViewLink);
      setUploadedName(file.name);
    } catch {
      onError?.("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  };

  const showUploadedLink = uploadedName || (value && !notConfigured);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {showUploadedLink ? (
        <div className="mt-1 flex items-center gap-2 text-sm">
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="truncate text-primary underline"
          >
            {uploadedName ?? value}
          </a>
          <button
            type="button"
            className="shrink-0 text-xs text-muted-foreground underline"
            onClick={() => {
              setUploadedName(null);
              onChange("");
            }}
          >
            Remove
          </button>
        </div>
      ) : notConfigured ? (
        <>
          <Input
            id={id}
            type="url"
            className="mt-1"
            placeholder="https://drive.google.com/..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Drive upload not configured — paste the link manually.
          </p>
        </>
      ) : (
        <div className="mt-1">
          <input
            id={id}
            type="file"
            accept={accept}
            className="w-full text-sm"
            disabled={uploading}
            onChange={handleFileChange}
          />
          {uploading ? (
            <p className="mt-1 text-xs text-muted-foreground">Uploading...</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
