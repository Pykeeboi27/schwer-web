"use client";

import {
  changePasswordAction,
  type ChangePasswordActionState,
} from "@/app/protected/account/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/utils/toast-notification";
import { Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current user's email, shown so it's clear which account is being changed. */
  email?: string;
  /**
   * The element that opened this dialog (e.g. the account-menu trigger).
   * Focus is returned here on close -- otherwise Radix tries to restore
   * focus to the dropdown item that opened the dialog, which has already
   * unmounted, and focus silently drops to <body>.
   */
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
};

const initialChangePasswordState: ChangePasswordActionState = {
  error: null,
  success: false,
};

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

const FIELD_LABELS: Record<PasswordField, string> = {
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Confirm new password",
};

/**
 * Change-password form. Kept as an inner component so it unmounts along with
 * the dialog's `DialogContent` on close, which resets `useActionState` and
 * the field values for free -- no manual reset bookkeeping needed.
 */
function ChangePasswordForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialChangePasswordState,
  );
  const [visibleFields, setVisibleFields] = useState<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const { success } = useToast();

  useEffect(() => {
    if (state.success) {
      success("Password changed successfully.");
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const toggleVisibility = (field: PasswordField) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const renderField = (field: PasswordField) => (
    <div className="grid gap-1.5" key={field}>
      <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
      <div className="relative">
        <Input
          id={field}
          name={field}
          type={visibleFields[field] ? "text" : "password"}
          required
          autoComplete={field === "currentPassword" ? "current-password" : "new-password"}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => toggleVisibility(field)}
          aria-label={
            visibleFields[field]
              ? `Hide ${FIELD_LABELS[field].toLowerCase()}`
              : `Show ${FIELD_LABELS[field].toLowerCase()}`
          }
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          {visibleFields[field] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <form action={formAction} className="space-y-4">
      {renderField("currentPassword")}
      {renderField("newPassword")}
      {renderField("confirmPassword")}

      {state.error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Change password"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  email,
  restoreFocusRef,
}: ChangePasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          if (restoreFocusRef?.current) {
            event.preventDefault();
            restoreFocusRef.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            {email
              ? `Enter your current password, then choose a new one for ${email}.`
              : "Enter your current password, then choose a new one."}
          </DialogDescription>
        </DialogHeader>

        <ChangePasswordForm
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
