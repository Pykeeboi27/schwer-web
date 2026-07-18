"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationItem } from "@/components/notifications/notification-item";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { useNotificationsRealtime } from "@/components/notifications/use-notifications-realtime";
import { useNotificationSound } from "@/components/notifications/use-notification-sound";
import { useToast } from "@/lib/utils/toast-notification";
import { formatUnreadCount } from "@/lib/notifications/links";
import type { Notification } from "@/lib/notifications/types";

type NotificationBellProps = {
  userId: string;
  initialUnreadCount: number;
  initialNotifications: Notification[];
};

const MAX_RECENT = 15;

export function NotificationBell({
  userId,
  initialUnreadCount,
  initialNotifications,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState(initialNotifications);
  const playSound = useNotificationSound();
  const toast = useToast();

  // Server props are the source of truth; realtime only adds an optimistic
  // bump between the event and the debounced router.refresh() reconciling it.
  useEffect(() => {
    setUnreadCount(initialUnreadCount);
    setNotifications(initialNotifications);
  }, [initialUnreadCount, initialNotifications]);

  useNotificationsRealtime(userId, (row) => {
    setUnreadCount((count) => count + 1);
    setNotifications((prev) =>
      [
        {
          id: row.id,
          type: row.type,
          section: row.section,
          entityType: row.entity_type,
          entityId: row.entity_id,
          title: row.title,
          body: row.body,
          link: row.link,
          actorName: null,
          readAt: null,
          seenAt: null,
          createdAt: row.created_at,
        } satisfies Notification,
        ...prev,
      ].slice(0, MAX_RECENT),
    );
    playSound();
    toast.info(row.title);
  });

  const badgeLabel = formatUnreadCount(unreadCount);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            badgeLabel ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {badgeLabel ? (
            <CountBadge count={badgeLabel} className="absolute -right-0.5 -top-0.5" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 ? <MarkAllReadButton /> : null}
        </div>

        <div className="max-h-[380px] overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNavigate={() => setOpen(false)}
              />
            ))
          )}
        </div>

        <Link
          href="/protected/notifications"
          onClick={() => setOpen(false)}
          className="block border-t px-3 py-2 text-center text-sm text-primary hover:underline"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
