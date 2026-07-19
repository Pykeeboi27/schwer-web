"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/notifications/links";
import type { Notification } from "@/lib/notifications/types";
import { markNotificationReadAction } from "@/app/protected/notifications/actions";

type NotificationItemProps = {
  notification: Notification;
  /** Fired after the read-mark completes, before navigating (e.g. closes the bell dropdown). */
  onNavigate?: () => void;
};

/**
 * One notification row, shared by the bell dropdown and the full history
 * page. Clicking marks it read (bell count) and seen (nav dot), then
 * navigates to the entity's page/tab.
 */
export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isUnread = notification.readAt === null;

  const handleClick = () => {
    onNavigate?.();
    router.push(notification.link);

    if (isUnread) {
      startTransition(() => {
        void markNotificationReadAction(notification.id);
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-70",
        isUnread && "bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("break-words font-medium", isUnread && "text-foreground")}>
          {notification.title}
        </span>
        {isUnread ? (
          <span
            aria-hidden
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
          />
        ) : null}
      </div>
      {notification.body ? (
        <p className="whitespace-pre-line break-words text-xs text-muted-foreground">
          {notification.body}
        </p>
      ) : null}
      <span className="text-xs text-muted-foreground">
        {notification.actorName ? `${notification.actorName} · ` : ""}
        {formatRelativeTime(notification.createdAt)}
      </span>
    </button>
  );
}
