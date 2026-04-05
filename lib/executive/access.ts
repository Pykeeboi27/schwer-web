import type { CurrentProfile } from "@/lib/profile/get-current-profile";

export function isExecutiveDashboardViewer(profile: CurrentProfile | null): boolean {
  if (!profile || !profile.isActive) {
    return false;
  }

  return (
    Boolean(profile.isExecutiveViewer) ||
    profile.role === "owner" ||
    profile.role === "executive"
  );
}

export function isTargetEditor(profile: CurrentProfile | null): boolean {
  if (!profile || !profile.isActive) {
    return false;
  }

  return profile.role === "owner" || profile.role === "executive";
}

export function getExecutiveFallbackPath(profile: CurrentProfile | null): string {
  if (!profile) {
    return "/auth/login";
  }

  if (!profile.department) {
    return "/auth/choose-department";
  }

  return `/protected/${profile.department}`;
}

function getExecutiveNoAccessPath(): string {
  const params = new URLSearchParams({
    error: "You do not have access to the Executive Dashboard.",
    retry: "/protected",
  });

  return `/auth/error?${params.toString()}`;
}

export function getExecutiveAccessRedirect(
  profile: CurrentProfile | null,
  pathname = "/protected/executive",
): string | null {
  if (pathname.startsWith("/protected/executive") && isExecutiveDashboardViewer(profile)) {
    return null;
  }

  const fallbackPath = getExecutiveFallbackPath(profile);

  // Prevent redirect loops when a non-viewer resolves back to /protected/executive.
  if (pathname.startsWith("/protected/executive") && fallbackPath.startsWith("/protected/executive")) {
    return getExecutiveNoAccessPath();
  }

  return fallbackPath;
}
