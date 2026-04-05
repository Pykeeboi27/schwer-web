import { LoginForm } from "@/components/login-form";
import { SchwerLogo } from "@/components/schwer-logo";
import {
  ensureCurrentProfile,
  isEnsureCurrentProfileError,
} from "@/lib/profile/ensure-current-profile";
import {
  getPostAuthRedirectPath,
  isSafeProtectedRedirectTarget,
} from "@/lib/profile/redirect-to-dashboard";
import Link from "next/link";
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
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-gradient-to-br from-secondary/30 via-background to-background p-6 md:p-10">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />

      <div className="w-full max-w-sm space-y-4">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to home
        </Link>

        <div className="inline-flex items-center gap-3 rounded-lg border bg-background/70 px-3 py-2 backdrop-blur">
          <SchwerLogo className="h-6" />
          <span className="text-sm font-semibold">Schwer Online Management</span>
        </div>

        <LoginForm redirectTo={safeRedirectTo} />
      </div>
    </div>
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
