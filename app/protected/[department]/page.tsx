import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getDepartmentDashboardPath } from "@/lib/profile/redirect-to-dashboard";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type DepartmentPageProps = {
  params: Promise<{ department: string }>;
};

async function DepartmentPageContent({ params }: DepartmentPageProps) {
  const { department } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (!profile.department) {
    redirect("/auth/choose-department");
  }

  if (department !== profile.department) {
    redirect(getDepartmentDashboardPath(profile.department));
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="rounded-lg border border-l-4 border-l-primary bg-card p-4 shadow-xs sm:p-5">
        <h1 className="text-2xl font-semibold capitalize tracking-tight">
          {department} Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in and can access the {department} dashboard.
        </p>
      </div>
    </div>
  );
}

export default function DepartmentPage({ params }: DepartmentPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 w-full text-sm text-muted-foreground">
          Loading dashboard...
        </div>
      }
    >
      <DepartmentPageContent params={params} />
    </Suspense>
  );
}
