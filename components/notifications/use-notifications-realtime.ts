"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/notifications/types";

const REFRESH_DEBOUNCE_MS = 400;

/** Raw shape of a realtime INSERT payload row (snake_case, no joins). */
type NotificationInsertPayload = {
  id: string;
  type: Notification["type"];
  section: Notification["section"];
  entity_type: Notification["entityType"];
  entity_id: string;
  title: string;
  body: string | null;
  link: string;
  created_at: string;
};

/**
 * Subscribes to a per-user filtered realtime channel for new notifications --
 * the first filtered postgres_changes subscription in this codebase (existing
 * RealtimeRefresh channels are unfiltered/table-wide). Fires `onInsert` with
 * the raw row for each new notification (no actor join available from the
 * realtime payload), then debounces a `router.refresh()` so the server
 * components downstream (bell/list/nav dots) reconcile with the full,
 * actor-joined data shortly after.
 */
export function useNotificationsRealtime(
  userId: string | null,
  onInsert: (row: NotificationInsertPayload) => void,
) {
  const router = useRouter();
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createClient();
    const timeoutRef = { current: null as ReturnType<typeof setTimeout> | null };

    const scheduleRefresh = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          onInsertRef.current(payload.new as NotificationInsertPayload);
          scheduleRefresh();
        },
      )
      .subscribe((status, err) => {
        // This channel has no visible UI of its own (unlike a failed data
        // fetch, which renders an error state) -- a silently failed
        // subscription here means notifications never arrive live with no
        // other symptom, so surface every non-happy status loudly.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Notifications realtime channel ${status}:`, err);
        } else if (status === "CLOSED") {
          console.warn("Notifications realtime channel closed unexpectedly");
        } else {
          console.info(`Notifications realtime channel: ${status}`);
        }
      });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
