import { cache } from "react";

import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import type { Notification, NotificationSection } from "@/lib/notifications/types";

type NotificationRow = {
  id: string;
  type: Notification["type"];
  section: NotificationSection;
  entity_type: Notification["entityType"];
  entity_id: string;
  title: string;
  body: string | null;
  link: string;
  read_at: string | null;
  seen_at: string | null;
  created_at: string;
  actor:
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null;
};

/** Full name if set, else the email username (before the "@"), else null. */
function resolveDisplayName(
  profile: { full_name?: string | null; email?: string | null } | null | undefined,
): string | null {
  const fullName = profile?.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const email = profile?.email?.trim();
  if (email) {
    return email.split("@")[0];
  }

  return null;
}

function toNotification(row: NotificationRow): Notification {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;

  return {
    id: row.id,
    type: row.type,
    section: row.section,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    body: row.body,
    link: row.link,
    actorName: resolveDisplayName(actor),
    readAt: row.read_at,
    seenAt: row.seen_at,
    createdAt: row.created_at,
  };
}

const NOTIFICATION_SELECT =
  "id, type, section, entity_type, entity_id, title, body, link, read_at, seen_at, created_at, actor:actor_id(full_name, email)";

export async function getUnreadCount(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return 0;
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) {
    throw new Error("Failed to load unread notification count.");
  }

  return count ?? 0;
}

export async function getRecentNotifications(limit = 15): Promise<Notification[]> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Failed to load notifications.");
  }

  return (data ?? []).map((row) => toNotification(row as NotificationRow));
}

export async function listNotifications(input: {
  page: number;
  pageSize?: number;
}): Promise<{ items: Notification[]; total: number; hasMore: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { items: [], total: 0, hasMore: false };
  }

  const pageSize = input.pageSize ?? 20;
  const page = Math.max(1, input.page);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT, { count: "exact" })
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error("Failed to load notification history.");
  }

  const total = count ?? 0;

  return {
    items: (data ?? []).map((row) => toNotification(row as NotificationRow)),
    total,
    hasMore: to + 1 < total,
  };
}

/**
 * Feeds the small "unseen changes" dots on nav tabs. Both SidebarSlot and
 * MobileNavSlot call this on every request, so it's request-scoped memoized
 * (matches getCurrentProfile()'s cache()) to collapse them into one query.
 */
export const getUnseenSections = cache(async (): Promise<Set<NotificationSection>> => {
  const profile = await getCurrentProfile();
  if (!profile) {
    return new Set();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("section")
    .eq("recipient_id", profile.id)
    .is("seen_at", null);

  if (error) {
    throw new Error("Failed to load unseen notification sections.");
  }

  return new Set((data ?? []).map((row) => row.section as NotificationSection));
});
