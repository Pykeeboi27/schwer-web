import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  ensureCurrentProfile,
  isEnsureCurrentProfileError,
} from "@/lib/profile/ensure-current-profile";
import {
  getPostAuthRedirectPath,
  isSafeProtectedRedirectTarget,
} from "@/lib/profile/redirect-to-dashboard";

type ProtectedPageProps = {
  searchParams?: Promise<{ redirectTo?: string }>;
};

async function ProtectedPageContent({ searchParams }: ProtectedPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirectTo;
  const safeRedirectTo = isSafeProtectedRedirectTarget(redirectTo) ? redirectTo : null;
  const retryPath = safeRedirectTo
    ? `/protected?redirectTo=${encodeURIComponent(safeRedirectTo)}`
    : "/protected";

  let profile;

  try {
    profile = await ensureCurrentProfile();
  } catch (error) {
    if (isEnsureCurrentProfileError(error)) {
      const params = new URLSearchParams({
        error: "We couldn't load your profile. Please try again.",
        retry: retryPath,
      });

      redirect(`/auth/error?${params.toString()}`);
    }

    throw error;
  }

  if (!profile) {
    const params = new URLSearchParams({
      redirectTo: safeRedirectTo ?? "/protected",
    });

    redirect(`/auth/login?${params.toString()}`);
  }

  redirect(getPostAuthRedirectPath(profile, safeRedirectTo));

  return null;
}

export default function ProtectedPage({ searchParams }: ProtectedPageProps) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <ProtectedPageContent searchParams={searchParams} />
    </Suspense>
  );
}
