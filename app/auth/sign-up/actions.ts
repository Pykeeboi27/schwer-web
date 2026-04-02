"use server";

import { DEPARTMENTS, isDepartment, type Department } from "@/lib/profile/departments";
import { createClient } from "@/lib/supabase/server";

export type SignUpActionState = {
  error: string | null;
  success: boolean;
};

function normalizeSignUpErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("email rate limit") ||
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("rate limit")
  ) {
    return "Too many sign-up attempts in a short time. Please wait a minute and try again, or use a different email during testing.";
  }

  return message;
}

export async function signUpAction(
  _prevState: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const repeatPassword = String(formData.get("repeatPassword") ?? "");
  const departmentRaw = String(formData.get("department") ?? "").trim();

  if (!email || !password || !repeatPassword || !departmentRaw) {
    return {
      error: "Email, password, repeat password, and department are required",
      success: false,
    };
  }

  if (!isDepartment(departmentRaw)) {
    return {
      error: `Department must be one of: ${DEPARTMENTS.join(", ")}`,
      success: false,
    };
  }

  if (password !== repeatPassword) {
    return {
      error: "Passwords do not match",
      success: false,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        department: departmentRaw as Department,
      },
    },
  });

  if (error) {
    return {
      error: normalizeSignUpErrorMessage(error.message),
      success: false,
    };
  }

  return {
    error: null,
    success: true,
  };
}
