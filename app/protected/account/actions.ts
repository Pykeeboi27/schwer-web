"use server";

import { createVerificationClient } from "@/lib/supabase/verify-client";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordActionState = {
  error: string | null;
  success: boolean;
};

function normalizePasswordUpdateErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("same password") ||
    normalized.includes("different from the old password")
  ) {
    return "New password must be different from your current password";
  }

  if (normalized.includes("reauthentication") || normalized.includes("nonce")) {
    return "Password changes need to be re-enabled for this project. Contact your administrator";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Too many attempts. Please wait a minute and try again";
  }

  if (
    (normalized.includes("session") && normalized.includes("not found")) ||
    normalized.includes("jwt expired")
  ) {
    return "Your session has expired. Please sign in again";
  }

  return message;
}

export async function changePasswordAction(
  _prevState: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      error: "All password fields are required",
      success: false,
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      error: "New passwords do not match",
      success: false,
    };
  }

  if (newPassword === currentPassword) {
    return {
      error: "New password must be different from your current password",
      success: false,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

  if (!email) {
    return {
      error: "Your session has expired. Please sign in again",
      success: false,
    };
  }

  // Re-verify the current password on a throwaway, session-less client so the
  // check never touches the signed-in user's real sb-* cookies. The email
  // used here always comes from the server-side session above, never from
  // the submitted form, so this can't be used to probe another account.
  const verifier = createVerificationClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    try {
      await verifier.auth.signOut({ scope: "local" });
    } catch {
      // Best-effort cleanup of the throwaway session; nothing to do if it fails.
    }

    const normalized = verifyError.message.toLowerCase();
    if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
      return {
        error: "Too many attempts. Please wait a minute and try again",
        success: false,
      };
    }

    return {
      error: "Current password is incorrect",
      success: false,
    };
  }

  // Apply the change on the user's real, cookie-bound session so it stays the
  // surviving session -- GoTrue revokes every other session for this user.
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  try {
    // Expected to fail here: a successful updateUser already revoked this
    // throwaway session server-side. Still best-effort in case it didn't.
    await verifier.auth.signOut({ scope: "local" });
  } catch {
    // Ignore; nothing to clean up if this fails.
  }

  if (updateError) {
    return {
      error: normalizePasswordUpdateErrorMessage(updateError.message),
      success: false,
    };
  }

  return {
    error: null,
    success: true,
  };
}
