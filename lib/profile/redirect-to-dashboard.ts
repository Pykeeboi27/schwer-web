import type { CurrentProfile } from "@/lib/profile/get-current-profile";

export function getDepartmentDashboardPath(department: string): string {
  return `/protected/${department}`;
}

export function getPostAuthRedirectPath(profile: CurrentProfile | null): string {
  if (!profile?.department) {
    return "/auth/choose-department";
  }

  return getDepartmentDashboardPath(profile.department);
}
