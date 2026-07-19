"use client";

import { useEffect, useRef } from "react";

import { markSectionSeenAction } from "@/app/protected/notifications/actions";
import type { NotificationSection } from "@/lib/notifications/types";

/**
 * Clears the nav-tab "unseen changes" dot for `section` on mount -- visiting
 * the tab clears the dot even if the underlying notification is never
 * clicked. Renders nothing. Mount once per page that owns a notification
 * section (Quotations, Purchase Orders, Approvals, Costing Approval, Request
 * for Quotation).
 */
export function MarkSectionSeen({ section }: { section: NotificationSection }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;
    void markSectionSeenAction(section);
    // Runs once per mount; a route change to the same section (e.g. filters)
    // shouldn't re-fire the mutation on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
