import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const origin = new URL(request.url).origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/confirm?next=/protected`,
    },
  });

  if (error || !data.url) {
    const message = error?.message ?? "Unable to start Google authentication";
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(message)}`, request.url),
    );
  }

  return NextResponse.redirect(data.url);
}
