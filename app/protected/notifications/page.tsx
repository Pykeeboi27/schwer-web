import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader, Panel } from "@/components/patterns";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationItem } from "@/components/notifications/notification-item";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { listNotifications } from "@/lib/notifications/queries";
import { groupNotifications } from "@/lib/notifications/group";

const PAGE_SIZE = 20;

type NotificationsPageProps = {
  searchParams?: Promise<{ page?: string }>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const page = Math.max(1, Number(resolvedSearchParams?.page ?? "1") || 1);

  const { items, total, hasMore } = await listNotifications({
    page,
    pageSize: PAGE_SIZE,
  });
  const groupedItems = groupNotifications(items);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Every quotation, purchase order, and approval update related to you."
        actions={total > 0 ? <MarkAllReadButton /> : undefined}
      />

      <Panel padded={items.length === 0}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no notifications yet.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {groupedItems.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </Panel>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`/protected/notifications?page=${page - 1}`}
              className="text-primary hover:underline"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link
              href={`/protected/notifications?page=${page + 1}`}
              className="text-primary hover:underline"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
