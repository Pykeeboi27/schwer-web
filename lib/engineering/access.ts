import type { CurrentProfile } from "@/lib/profile/get-current-profile";

export function canAccessEngineeringDashboard(profile: CurrentProfile | null): boolean {
  return Boolean(profile && profile.isActive && profile.department === "engineering");
}

export function getEngineeringFallbackPath(profile: CurrentProfile | null): string {
  if (!profile) {
    return "/auth/login";
  }

  if (!profile.department) {
    return "/auth/choose-department";
  }

  return `/protected/${profile.department}`;
}

export function getEngineeringAccessRedirect(
  profile: CurrentProfile | null,
  pathname: string,
): string | null {
  if (pathname.startsWith("/protected/engineering") && canAccessEngineeringDashboard(profile)) {
    return null;
  }

  return getEngineeringFallbackPath(profile);
}
