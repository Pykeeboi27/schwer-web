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
