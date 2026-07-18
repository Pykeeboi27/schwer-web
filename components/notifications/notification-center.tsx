import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getRecentNotifications, getUnreadCount } from "@/lib/notifications/queries";
import { NotificationBell } from "@/components/notifications/notification-bell";

/**
 * Server-side data fetch for the bell -- mirrors SidebarSlot's shape (fetch
 * with getCurrentProfile(), hand fully-loaded data to a client component).
 * Renders nothing for signed-out/no-profile requests.
 */
export async function NotificationCenter() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return null;
  }

  const [unreadCount, notifications] = await Promise.all([
    getUnreadCount(),
    getRecentNotifications(),
  ]);

  return (
    <NotificationBell
      userId={profile.id}
      initialUnreadCount={unreadCount}
      initialNotifications={notifications}
    />
  );
}
