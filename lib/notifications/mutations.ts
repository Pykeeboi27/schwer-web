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

/**
 * Marks a batch of notifications read (bell unread count) and seen (nav-tab
 * dot) in one update -- used when a grouped notification row is clicked, so
 * every underlying id in the group clears together, not just the one whose
 * link was followed. No-op on an empty list.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in to update notifications.");
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now, seen_at: now })
    .in("id", ids)
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message || "Failed to mark notifications as read.");
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
 * Marks every unread notification in a nav section read and seen. Called by
 * <MarkSectionRead> on mount for every watched page -- visiting the tab is
 * treated the same as reading everything currently notifying the user about
 * that section, so both the nav-tab dot (seen_at) and the bell/notifications
 * list (read_at) clear together. Filters on read_at IS NULL rather than
 * seen_at IS NULL: since read implies seen but not the reverse, read_at IS
 * NULL is the strict superset -- it also sweeps up rows that were already
 * seen on a prior visit but never explicitly clicked, which a seen_at-only
 * filter would skip forever.
 */
export async function markSectionRead(section: NotificationSection): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return;
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now, seen_at: now })
    .eq("recipient_id", profile.id)
    .eq("section", section)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message || "Failed to update notification state.");
  }
}
