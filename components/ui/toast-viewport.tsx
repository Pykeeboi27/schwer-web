"use client";

import { TOAST_EVENT_NAME, type ToastPayload } from "@/lib/utils/toast-notification";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useEffect, useState } from "react";

type ActiveToast = ToastPayload;

function removeToastById(toasts: ActiveToast[], toastId: string): ActiveToast[] {
  return toasts.filter((toast) => toast.id !== toastId);
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const payload = (event as CustomEvent<ToastPayload>).detail;

      if (!payload) {
        return;
      }

      setToasts((current) => [...current, payload]);

      window.setTimeout(() => {
        setToasts((current) => removeToastById(current, payload.id));
      }, payload.durationMs);
    };

    window.addEventListener(TOAST_EVENT_NAME, onToast as EventListener);

    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, onToast as EventListener);
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-0 z-[70] flex w-full max-w-sm flex-col gap-2 px-4 sm:right-4 sm:px-0"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.variant === "success";
        const isError = toast.variant === "error";

        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-sm",
              isSuccess && "border-emerald-300 bg-emerald-50 text-emerald-900",
              isError && "border-red-300 bg-red-50 text-red-900",
              toast.variant === "info" && "border-blue-300 bg-blue-50 text-blue-900",
            )}
            role={isError ? "alert" : "status"}
          >
            {isSuccess ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : null}
            {isError ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : null}
            {toast.variant === "info" ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : null}
            <p>{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
}
