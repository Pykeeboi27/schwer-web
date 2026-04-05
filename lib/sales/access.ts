import type { CurrentProfile } from "@/lib/profile/get-current-profile";

export function canAccessSalesDashboard(profile: CurrentProfile | null): boolean {
  return Boolean(profile && profile.isActive && profile.department === "sales");
}

export function canAccessSalesQuotations(profile: CurrentProfile | null): boolean {
  if (!profile || !profile.isActive) {
    return false;
  }

  if (profile.department === "sales") {
    return true;
  }

  return profile.role === "owner" || profile.role === "executive";
}

export function getSalesFallbackPath(profile: CurrentProfile | null): string {
  if (!profile) {
    return "/auth/login";
  }

  if (!profile.department) {
    return "/auth/choose-department";
  }

  return `/protected/${profile.department}`;
}

export function canAccessSalesRoute(
  profile: CurrentProfile | null,
  pathname: string,
): boolean {
  if (pathname.startsWith("/protected/sales/quotations")) {
    return canAccessSalesQuotations(profile);
  }

  return canAccessSalesDashboard(profile);
}

export function getSalesAccessRedirect(
  profile: CurrentProfile | null,
  pathname: string,
): string | null {
  if (canAccessSalesRoute(profile, pathname)) {
    return null;
  }

  return getSalesFallbackPath(profile);
}
