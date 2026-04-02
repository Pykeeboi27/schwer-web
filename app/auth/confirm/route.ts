import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getPostAuthRedirectPath } from "@/lib/profile/redirect-to-dashboard";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/protected";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }

    // If a department exists, route to that dashboard. Otherwise require selection.
    const profile = await getCurrentProfile();
    const targetPath = getPostAuthRedirectPath(profile);

    // Preserve explicit non-root next param only when department is already known.
    if (targetPath.startsWith("/protected/") && next !== "/" && next !== "/protected") {
      redirect(next);
    }

    redirect(targetPath);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }

    const profile = await getCurrentProfile();
    redirect(getPostAuthRedirectPath(profile));
  }

  redirect("/auth/error?error=No token hash, code, or type");
}
