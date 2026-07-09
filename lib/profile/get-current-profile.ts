import { cache } from "react";

import {
  ensureCurrentProfile,
  type CurrentProfile,
} from "@/lib/profile/ensure-current-profile";

export type { CurrentProfile };

/**
 * Request-scoped memoization: the sidebar, mobile nav, and the page component
 * each ask for the current profile during a single render. `cache()` collapses
 * those into one Supabase round-trip per request.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  try {
    return await ensureCurrentProfile();
  } catch {
    return null;
  }
});

export function hasExecutiveApprovalAccess(profile: CurrentProfile | null): boolean {
  if (!profile || !profile.isActive) {
    return false;
  }

  return (
    profile.isExecutiveViewer || profile.role === "owner" || profile.role === "executive"
  );
}
