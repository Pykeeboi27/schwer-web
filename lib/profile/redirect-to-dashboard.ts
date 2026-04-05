import type { CurrentProfile } from "@/lib/profile/get-current-profile";

export function getDepartmentDashboardPath(department: string): string {
  return `/protected/${department}`;
}

export function isSafeProtectedRedirectTarget(target: string | null | undefined): target is string {
  return typeof target === "string" && /^\/protected(\/|\?|$)/.test(target);
}

export function getPostAuthRedirectPath(
  profile: CurrentProfile | null,
  redirectTo?: string | null,
): string {
  const safeRedirectTo = isSafeProtectedRedirectTarget(redirectTo) ? redirectTo : null;

  if (!profile?.department) {
    if (safeRedirectTo) {
      return `/auth/choose-department?redirectTo=${encodeURIComponent(safeRedirectTo)}`;
    }

    return "/auth/choose-department";
  }

  if (safeRedirectTo && safeRedirectTo !== "/protected") {
    return safeRedirectTo;
  }

  return getDepartmentDashboardPath(profile.department);
}
