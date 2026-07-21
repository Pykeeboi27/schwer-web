import { describe, expect, it } from "vitest";

import { groupNotifications } from "@/lib/notifications/group";
import type { Notification } from "@/lib/notifications/types";

function makeNotification(
  overrides: Partial<Notification> & { id: string },
): Notification {
  return {
    type: "quotation_approved",
    section: "quotations",
    entityType: "quotation",
    entityId: "q1",
    title: "Quotation Q-1 was approved",
    body: null,
    link: "/protected/sales/quotations",
    actorName: null,
    readAt: null,
    seenAt: null,
    createdAt: "2026-07-21T12:00:00.000Z",
    ...overrides,
  };
}

describe("groupNotifications", () => {
  it("keeps a single notification as a group of one", () => {
    const groups = groupNotifications([makeNotification({ id: "n1" })]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "n1", ids: ["n1"], count: 1 });
  });

  it("merges same (type, entityId) rows within the 10-minute window", () => {
    const groups = groupNotifications([
      makeNotification({
        id: "n3",
        createdAt: "2026-07-21T12:08:00.000Z",
        actorName: "Maria",
      }),
      makeNotification({
        id: "n2",
        createdAt: "2026-07-21T12:04:00.000Z",
        actorName: "Jose",
      }),
      makeNotification({
        id: "n1",
        createdAt: "2026-07-21T12:00:00.000Z",
        actorName: "Ana",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].ids).toEqual(["n3", "n2", "n1"]);
    expect(groups[0].count).toBe(3);
    expect(groups[0].actorSummary).toBe("Maria and 2 others");
  });

  it("does not merge rows further apart than the window, even for the same entity/type", () => {
    const groups = groupNotifications([
      makeNotification({ id: "n2", createdAt: "2026-07-21T12:20:00.000Z" }),
      makeNotification({ id: "n1", createdAt: "2026-07-21T12:00:00.000Z" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.id)).toEqual(["n2", "n1"]);
  });

  it("never merges across different entities, even within the window", () => {
    const groups = groupNotifications([
      makeNotification({
        id: "n2",
        entityId: "q2",
        createdAt: "2026-07-21T12:01:00.000Z",
      }),
      makeNotification({
        id: "n1",
        entityId: "q1",
        createdAt: "2026-07-21T12:00:00.000Z",
      }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("never merges across different notification types on the same entity", () => {
    const groups = groupNotifications([
      makeNotification({
        id: "n2",
        type: "quotation_rejected",
        createdAt: "2026-07-21T12:01:00.000Z",
      }),
      makeNotification({
        id: "n1",
        type: "quotation_approved",
        createdAt: "2026-07-21T12:00:00.000Z",
      }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("marks a group unread if any underlying row is unread", () => {
    const groups = groupNotifications([
      makeNotification({
        id: "n2",
        createdAt: "2026-07-21T12:02:00.000Z",
        readAt: "2026-07-21T12:05:00.000Z",
      }),
      makeNotification({ id: "n1", createdAt: "2026-07-21T12:00:00.000Z", readAt: null }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].isUnread).toBe(true);
  });

  it("uses a single actor name with no 'others' suffix when only one actor is present", () => {
    const groups = groupNotifications([
      makeNotification({
        id: "n2",
        createdAt: "2026-07-21T12:02:00.000Z",
        actorName: "Maria",
      }),
      makeNotification({
        id: "n1",
        createdAt: "2026-07-21T12:00:00.000Z",
        actorName: "Maria",
      }),
    ]);

    expect(groups[0].actorSummary).toBe("Maria");
  });
});
