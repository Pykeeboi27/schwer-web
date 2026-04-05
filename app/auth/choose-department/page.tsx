import { DEPARTMENTS, isDepartment } from "@/lib/profile/departments";
import {
  ensureCurrentProfile,
  isEnsureCurrentProfileError,
} from "@/lib/profile/ensure-current-profile";
import { getDepartmentDashboardPath } from "@/lib/profile/redirect-to-dashboard";
import { isSafeProtectedRedirectTarget } from "@/lib/profile/redirect-to-dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export function validateDepartmentSelection(department: string): string | null {
  if (!isDepartment(department)) {
    return `Department must be one of: ${DEPARTMENTS.join(", ")}`;
  }

  return null;
}

type ChooseDepartmentPageProps = {
  searchParams?: Promise<{ error?: string; redirectTo?: string }>;
};

async function ChooseDepartmentContent({
  searchParams,
}: ChooseDepartmentPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedSearchParams?.error ?? null;
  const redirectTo = resolvedSearchParams?.redirectTo;
  const safeRedirectTo = isSafeProtectedRedirectTarget(redirectTo) ? redirectTo : null;
  const retryPath = safeRedirectTo
    ? `/auth/choose-department?redirectTo=${encodeURIComponent(safeRedirectTo)}`
    : "/auth/choose-department";

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

  if (profile.department) {
    redirect(safeRedirectTo ?? getDepartmentDashboardPath(profile.department));
  }

  async function chooseDepartmentAction(formData: FormData) {
    "use server";

    const departmentRaw = String(formData.get("department") ?? "").trim();
    const validationError = validateDepartmentSelection(departmentRaw);

    if (validationError) {
      const params = new URLSearchParams({
        error: validationError,
      });

      if (safeRedirectTo) {
        params.set("redirectTo", safeRedirectTo);
      }

      redirect(`/auth/choose-department?${params.toString()}`);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      const params = new URLSearchParams({
        redirectTo: safeRedirectTo ?? "/protected",
      });

      redirect(`/auth/login?${params.toString()}`);
    }

    const { error } = await supabase
      .from("profiles")
      .update({ department: departmentRaw })
      .eq("id", user.id);

    if (error) {
      const params = new URLSearchParams({
        error: error.message,
      });

      if (safeRedirectTo) {
        params.set("redirectTo", safeRedirectTo);
      }

      redirect(`/auth/choose-department?${params.toString()}`);
    }

    redirect(safeRedirectTo ?? getDepartmentDashboardPath(departmentRaw));
  }

  return (
    <div className="w-full max-w-sm rounded-md border bg-card p-6">
      <h1 className="text-2xl font-semibold">Choose your department</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Select your department to continue to your dashboard.
      </p>

      <form action={chooseDepartmentAction} className="mt-6 flex flex-col gap-4">
        <label htmlFor="department" className="text-sm font-medium">
          Department
        </label>
        <select
          id="department"
          name="department"
          required
          defaultValue=""
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Select department
          </option>
          {DEPARTMENTS.map((department) => (
            <option key={department} value={department} className="capitalize">
              {department}
            </option>
          ))}
        </select>

        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

export default function ChooseDepartmentPage({
  searchParams,
}: ChooseDepartmentPageProps) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Suspense fallback={<div className="w-full max-w-sm rounded-md border bg-card p-6 text-sm text-muted-foreground">Loading department selector...</div>}>
        <ChooseDepartmentContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
