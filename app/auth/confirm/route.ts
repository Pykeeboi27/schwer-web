import { createClient } from "@/lib/supabase/server";
import {
  ensureCurrentProfile,
  isEnsureCurrentProfileError,
} from "@/lib/profile/ensure-current-profile";
import {
  getPostAuthRedirectPath,
  isSafeProtectedRedirectTarget,
} from "@/lib/profile/redirect-to-dashboard";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

function getProfileErrorRedirect(retryPath: string): string {
  const params = new URLSearchParams({
    error: "We couldn't load your profile. Please try again.",
    retry: retryPath,
  });

  return `/auth/error?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/protected";
  const redirectTo = isSafeProtectedRedirectTarget(next) ? next : null;
  const retryPath = redirectTo ? `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/auth/login";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }

    try {
      const profile = await ensureCurrentProfile();
      redirect(getPostAuthRedirectPath(profile, redirectTo));
    } catch (error) {
      if (isEnsureCurrentProfileError(error)) {
        redirect(getProfileErrorRedirect(retryPath));
      }

      throw error;
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }

    try {
      const profile = await ensureCurrentProfile();
      redirect(getPostAuthRedirectPath(profile, redirectTo));
    } catch (error) {
      if (isEnsureCurrentProfileError(error)) {
        redirect(getProfileErrorRedirect(retryPath));
      }

      throw error;
    }
  }

  redirect("/auth/error?error=No token hash, code, or type");
}
