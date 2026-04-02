"use server";

import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error: string | null;
  success: boolean;
};

function normalizeAuthErrorMessage(message: string): string {
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Email not confirmed";
  }

  return message;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Email and password are required",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: normalizeAuthErrorMessage(error.message),
      success: false,
    };
  }

  return {
    error: null,
    success: true,
  };
}
