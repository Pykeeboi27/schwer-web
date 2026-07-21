"use server";

import { revalidatePath } from "next/cache";

import {
  markAllRead,
  markNotificationRead,
  markSectionSeen,
} from "@/lib/notifications/mutations";
import type { NotificationSection } from "@/lib/notifications/types";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// The bell/nav dots render from the root protected layout, so any mutation
// here has to revalidate the whole layout subtree, not just one page path.
function revalidateNotificationSurfaces(): void {
  revalidatePath("/protected", "layout");
}

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResponse<{ id: string }>> {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId) {
    return { success: false, error: "Notification id is required." };
  }

  try {
    await markNotificationRead(normalizedId);
    revalidateNotificationSurfaces();
    return { success: true, data: { id: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update notification.",
    };
  }
}

export async function markAllReadAction(): Promise<ActionResponse<null>> {
  try {
    await markAllRead();
    revalidateNotificationSurfaces();
    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark all notifications as read.",
    };
  }
}

export async function markSectionSeenAction(
  section: NotificationSection,
): Promise<ActionResponse<null>> {
  try {
    await markSectionSeen(section);
    revalidateNotificationSurfaces();
    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update notification state.",
    };
  }
}
