import { DEPARTMENTS, isDepartment } from "@/lib/profile/departments";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getDepartmentDashboardPath } from "@/lib/profile/redirect-to-dashboard";
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
  searchParams?: Promise<{ error?: string }>;
};

async function ChooseDepartmentContent({
  searchParams,
}: ChooseDepartmentPageProps) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.department) {
    redirect(getDepartmentDashboardPath(profile.department));
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedSearchParams?.error ?? null;

  async function chooseDepartmentAction(formData: FormData) {
    "use server";

    const departmentRaw = String(formData.get("department") ?? "").trim();
    const validationError = validateDepartmentSelection(departmentRaw);

    if (validationError) {
      redirect(
        `/auth/choose-department?error=${encodeURIComponent(validationError)}`,
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      redirect("/auth/login");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ department: departmentRaw })
      .eq("id", user.id);

    if (error) {
      redirect(`/auth/choose-department?error=${encodeURIComponent(error.message)}`);
    }

    redirect(getDepartmentDashboardPath(departmentRaw));
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
