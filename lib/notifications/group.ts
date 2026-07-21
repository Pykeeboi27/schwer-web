import type {
  Notification,
  NotificationEntityType,
  NotificationSection,
  NotificationType,
} from "@/lib/notifications/types";

/** Same event type on the same entity, within this window, collapse into one row. */
const GROUP_WINDOW_MS = 10 * 60_000;

export type NotificationGroup = {
  /** Latest notification's id in the group -- used as the React key. */
  id: string;
  /** Every underlying notification id in the group, for batch mark-read. */
  ids: string[];
  type: NotificationType;
  section: NotificationSection;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  body: string | null;
  link: string;
  /** null for 1 notification with no actor; "X" for 1 actor; "X and N others" for many. */
  actorSummary: string | null;
  count: number;
  isUnread: boolean;
  createdAt: string;
};

type OpenGroup = {
  group: NotificationGroup;
  actorNames: Set<string>;
  lastCreatedAtMs: number;
};

function summarizeActors(actorNames: Set<string>): string | null {
  const names = Array.from(actorNames);
  if (names.length === 0) {
    return null;
  }
  if (names.length === 1) {
    return names[0];
  }
  const extra = names.length - 1;
  return `${names[0]} and ${extra} other${extra > 1 ? "s" : ""}`;
}

/**
 * Collapses notifications about the same (type, entityId) that arrived close
 * together into a single display row -- presentation-only, read-side. Does
 * NOT change unread counting (see getUnreadCount) -- the bell badge keeps
 * counting real rows; only list rendering groups them. Input must already be
 * sorted by createdAt descending (as getRecentNotifications/listNotifications
 * return it) since grouping merges based on proximity to the previous row
 * seen for that key.
 */
export function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const openByKey = new Map<string, OpenGroup>();

  for (const notification of notifications) {
    const key = `${notification.type}:${notification.entityId}`;
    const createdAtMs = new Date(notification.createdAt).getTime();
    const open = openByKey.get(key);

    if (open && open.lastCreatedAtMs - createdAtMs <= GROUP_WINDOW_MS) {
      open.group.ids.push(notification.id);
      open.group.count += 1;
      open.group.isUnread = open.group.isUnread || notification.readAt === null;
      if (notification.actorName) {
        open.actorNames.add(notification.actorName);
      }
      open.group.actorSummary = summarizeActors(open.actorNames);
      open.lastCreatedAtMs = createdAtMs;
      continue;
    }

    const actorNames = new Set<string>();
    if (notification.actorName) {
      actorNames.add(notification.actorName);
    }

    const group: NotificationGroup = {
      id: notification.id,
      ids: [notification.id],
      type: notification.type,
      section: notification.section,
      entityType: notification.entityType,
      entityId: notification.entityId,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      actorSummary: notification.actorName,
      count: 1,
      isUnread: notification.readAt === null,
      createdAt: notification.createdAt,
    };

    groups.push(group);
    openByKey.set(key, { group, actorNames, lastCreatedAtMs: createdAtMs });
  }

  return groups;
}
