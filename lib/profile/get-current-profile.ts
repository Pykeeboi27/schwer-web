import {
  ensureCurrentProfile,
  type CurrentProfile,
} from "@/lib/profile/ensure-current-profile";

export type { CurrentProfile };

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  try {
    return await ensureCurrentProfile();
  } catch {
    return null;
  }
}

export function hasExecutiveApprovalAccess(profile: CurrentProfile | null): boolean {
  if (!profile || !profile.isActive) {
    return false;
  }

  return (
    profile.isExecutiveViewer ||
    profile.role === "owner" ||
    profile.role === "executive"
  );
}
