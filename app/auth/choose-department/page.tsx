import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fieldClassName } from "@/components/patterns";
import { cn } from "@/lib/utils";
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

async function ChooseDepartmentContent({ searchParams }: ChooseDepartmentPageProps) {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choose your department</CardTitle>
        <CardDescription>
          Select your department to continue to your dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={chooseDepartmentAction} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="department" className="text-sm font-medium">
              Department
            </label>
            <select
              id="department"
              name="department"
              required
              defaultValue=""
              className={cn(fieldClassName, "h-9 py-1 capitalize")}
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
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ChooseDepartmentPage({
  searchParams,
}: ChooseDepartmentPageProps) {
  return (
    <AuthShell showBackLink={false}>
      <Suspense
        fallback={
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Loading department selector…
            </CardContent>
          </Card>
        }
      >
        <ChooseDepartmentContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
