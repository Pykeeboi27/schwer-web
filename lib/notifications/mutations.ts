import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import type { NotificationSection } from "@/lib/notifications/types";

/**
 * Marks one notification read (bell unread count) and, since the caller only
 * ever does this right before navigating to the notification's link, also
 * marks it seen (nav-tab dot) -- read implies seen, not the reverse.
 */
export async function markNotificationRead(id: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in to update notifications.");
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now, seen_at: now })
    .eq("id", id)
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message || "Failed to mark notification as read.");
  }
}

export async function markAllRead(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in to update notifications.");
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now, seen_at: now })
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message || "Failed to mark all notifications as read.");
  }
}

/**
 * Clears the "unseen changes" dot for a nav section. Called by
 * <MarkSectionSeen> on mount for every watched page -- visiting the tab
 * clears the dot even if the underlying notification was never opened.
 */
export async function markSectionSeen(section: NotificationSection): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ seen_at: new Date().toISOString() })
    .eq("recipient_id", profile.id)
    .eq("section", section)
    .is("seen_at", null);

  if (error) {
    throw new Error(error.message || "Failed to update notification state.");
  }
}
