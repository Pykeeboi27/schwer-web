"use client";

import { useCallback } from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastPayload = {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
};

export const TOAST_EVENT_NAME = "schwer:toast";

function emitToast(payload: ToastPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT_NAME, { detail: payload }));
}

export function useToast() {
  const notify = useCallback(
    (
      variant: ToastVariant,
      message: string,
      options?: {
        durationMs?: number;
      },
    ) => {
      const durationMs = options?.durationMs ?? (variant === "error" ? 5000 : 3000);

      emitToast({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        variant,
        message,
        durationMs,
      });
    },
    [],
  );

  return {
    notify,
    success: (message: string, durationMs = 3000) => notify("success", message, { durationMs }),
    error: (message: string, durationMs = 5000) => notify("error", message, { durationMs }),
    info: (message: string, durationMs = 3000) => notify("info", message, { durationMs }),
  };
}
