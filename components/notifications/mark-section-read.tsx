"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markSectionReadAction } from "@/app/protected/notifications/actions";
import type { NotificationSection } from "@/lib/notifications/types";

/**
 * Marks every unread notification in `section` read and seen on mount --
 * visiting the tab clears both the nav-tab "unseen changes" dot and the
 * bell/notifications-list unread state, even if the underlying notification
 * is never clicked. Renders nothing. Mount once per page that owns a
 * notification section (Quotations, Purchase Orders, Approvals, Costing
 * Approval, Request for Quotation, Engineering Quotations).
 *
 * The action's own revalidatePath() only marks the cache stale server-side --
 * it doesn't push a re-render to this already-mounted client on its own.
 * Explicitly router.refresh() once it resolves so the sidebar dot and bell
 * badge update immediately instead of only on the next manual page load.
 */
export function MarkSectionRead({ section }: { section: NotificationSection }) {
  const firedRef = useRef(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;
    startTransition(async () => {
      await markSectionReadAction(section);
      router.refresh();
    });
    // Runs once per mount; a route change to the same section (e.g. filters)
    // shouldn't re-fire the mutation on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
