import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/login-form";
import {
  ensureCurrentProfile,
  isEnsureCurrentProfileError,
} from "@/lib/profile/ensure-current-profile";
import {
  getPostAuthRedirectPath,
  isSafeProtectedRedirectTarget,
} from "@/lib/profile/redirect-to-dashboard";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type LoginPageProps = {
  searchParams?: Promise<{ redirectTo?: string }>;
};

async function LoginPageContent({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectTo = resolvedSearchParams?.redirectTo;
  const safeRedirectTo = isSafeProtectedRedirectTarget(redirectTo) ? redirectTo : null;

  try {
    const profile = await ensureCurrentProfile();

    if (profile) {
      redirect(getPostAuthRedirectPath(profile, safeRedirectTo));
    }
  } catch (error) {
    if (isEnsureCurrentProfileError(error)) {
      const params = new URLSearchParams({
        error: "We couldn't load your profile. Please try again.",
        retry: safeRedirectTo ? `/auth/login?redirectTo=${encodeURIComponent(safeRedirectTo)}` : "/auth/login",
      });

      redirect(`/auth/error?${params.toString()}`);
    }

    throw error;
  }

  return (
    <AuthShell>
      <LoginForm redirectTo={safeRedirectTo} />
    </AuthShell>
  );
}

export default function Page({ searchParams }: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 text-sm text-muted-foreground md:p-10">
          Loading login...
        </div>
      }
    >
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}
