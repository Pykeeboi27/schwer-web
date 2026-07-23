"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type RealtimeRefreshProps = {
  /**
   * Public schema table names to watch for INSERT/UPDATE/DELETE. RLS on
   * each table determines which rows the current session actually
   * receives change events for.
   */
  tables: string[];
};

const DEBOUNCE_MS = 400;

/**
 * Silently keeps a server-rendered page in sync with concurrent edits by
 * other users. Subscribes to Postgres changes on the given tables and
 * triggers a debounced `router.refresh()` so the page re-runs its existing
 * server loaders (with their joins, role filtering, and RLS) instead of
 * duplicating any query logic on the client. Renders nothing.
 */
export function RealtimeRefresh({ tables }: RealtimeRefreshProps) {
  const router = useRouter();
  const tablesKey = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const timeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    const hasSubscribedRef = { current: false };

    const scheduleRefresh = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        router.refresh();
      }, DEBOUNCE_MS);
    };

    const channel = supabase.channel(`realtime-refresh:${tablesKey}`);
    for (const table of tablesKey.split(",")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }
    channel.subscribe((status, err) => {
      // The underlying client auto-rejoins on a backoff timer whenever the
      // socket is still connected, so a blip on a channel that already
      // subscribed once (e.g. the Realtime tenant cold-starting after being
      // idle) is expected and self-heals -- only the initial join failing
      // points to a real config/RLS problem.
      if (status === "SUBSCRIBED") {
        hasSubscribedRef.current = true;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (hasSubscribedRef.current) {
          console.warn(
            `RealtimeRefresh[${tablesKey}] channel ${status}, reconnecting:`,
            err,
          );
        } else {
          console.error(`RealtimeRefresh[${tablesKey}] channel ${status}:`, err);
        }
      }
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey]);

  return null;
}
