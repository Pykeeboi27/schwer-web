import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  markAllRead,
  markNotificationRead,
  markNotificationsRead,
  markSectionRead,
} from "@/lib/notifications/mutations";

const ok = { data: null, error: null };
const fail = { data: null, error: { message: "boom" } };
const user = { id: "u1" };
// These functions resolve the actor via getCurrentProfile(), which does its
// own `.from("profiles")` lookup (separate from any other table's queue)
// after auth.getClaims().
const profileRow = {
  data: {
    id: "u1",
    email: "u1@example.com",
    department: "sales",
    is_active: true,
    role: "sales_manager",
    is_executive_viewer: false,
  },
  error: null,
};

/**
 * Wraps the current mockClient.from so the query builder used for `table`
 * can be inspected afterward (its chain methods are vi.fn()s, so e.g.
 * builder.update.mock.calls / builder.is.mock.calls are assertable).
 */
function captureBuilder(table: string) {
  const originalFrom = mockClient.from;
  let captured: ReturnType<typeof originalFrom> | undefined;
  mockClient.from = vi.fn((t: string) => {
    const builder = originalFrom(t);
    if (t === table) {
      captured = builder;
    }
    return builder;
  });
  return () => captured;
}

describe("markSectionRead", () => {
  it("is a no-op when signed out", async () => {
    mockClient = createSupabaseMock({ user: null });
    const getBuilder = captureBuilder("notifications");

    await expect(markSectionRead("quotations")).resolves.toBeUndefined();
    expect(getBuilder()).toBeUndefined();
  });

  it("marks every unread notification in the section read AND seen, filtering on read_at", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, notifications: ok },
    });
    const getBuilder = captureBuilder("notifications");

    await expect(markSectionRead("quotations")).resolves.toBeUndefined();

    const builder = getBuilder();
    expect(builder).toBeDefined();

    // Sets both timestamps (read implies seen), not just seen_at.
    const payload = builder!.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toHaveProperty("read_at");
    expect(payload).toHaveProperty("seen_at");
    expect(payload.read_at).toBe(payload.seen_at);

    // Scoped to this recipient and this section...
    expect(builder!.eq).toHaveBeenCalledWith("recipient_id", "u1");
    expect(builder!.eq).toHaveBeenCalledWith("section", "quotations");

    // ...and filters on read_at IS NULL (the strict superset of seen_at IS
    // NULL), not seen_at IS NULL -- see mutations.ts doc comment for why.
    expect(builder!.is).toHaveBeenCalledWith("read_at", null);
    expect(builder!.is).not.toHaveBeenCalledWith("seen_at", null);
  });

  it("throws when the update fails", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, notifications: fail },
    });
    await expect(markSectionRead("quotations")).rejects.toThrow("boom");
  });
});

describe("markNotificationsRead", () => {
  it("is a no-op for an empty id list (never touches the notifications table)", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, notifications: ok },
    });
    const getBuilder = captureBuilder("notifications");

    await expect(markNotificationsRead([])).resolves.toBeUndefined();
    expect(getBuilder()).toBeUndefined();
  });

  it("marks every id in the batch read AND seen, filtering on read_at IS NULL", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, notifications: ok },
    });
    const getBuilder = captureBuilder("notifications");

    await expect(markNotificationsRead(["n1", "n2", "n3"])).resolves.toBeUndefined();

    const builder = getBuilder();
    expect(builder).toBeDefined();

    const payload = builder!.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toHaveProperty("read_at");
    expect(payload).toHaveProperty("seen_at");
    expect(payload.read_at).toBe(payload.seen_at);

    expect(builder!.in).toHaveBeenCalledWith("id", ["n1", "n2", "n3"]);
    expect(builder!.eq).toHaveBeenCalledWith("recipient_id", "u1");
    expect(builder!.is).toHaveBeenCalledWith("read_at", null);
  });

  it("throws when signed out with a non-empty id list", async () => {
    mockClient = createSupabaseMock({ user: null });
    await expect(markNotificationsRead(["n1"])).rejects.toThrow(/must be signed in/);
  });

  it("throws when the update fails", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, notifications: fail },
    });
    await expect(markNotificationsRead(["n1"])).rejects.toThrow("boom");
  });
});

describe("markNotificationRead / markAllRead parity", () => {
  it("markNotificationRead sets both timestamps and filters on read_at IS NULL", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, notifications: ok },
    });
    const getBuilder = captureBuilder("notifications");

    await expect(markNotificationRead("n1")).resolves.toBeUndefined();

    const builder = getBuilder();
    const payload = builder!.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toHaveProperty("read_at");
    expect(payload).toHaveProperty("seen_at");
    expect(builder!.is).toHaveBeenCalledWith("read_at", null);
  });

  it("markAllRead sets both timestamps and filters on read_at IS NULL", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, notifications: ok },
    });
    const getBuilder = captureBuilder("notifications");

    await expect(markAllRead()).resolves.toBeUndefined();

    const builder = getBuilder();
    const payload = builder!.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toHaveProperty("read_at");
    expect(payload).toHaveProperty("seen_at");
    expect(builder!.is).toHaveBeenCalledWith("read_at", null);
  });

  it("both throw when signed out", async () => {
    mockClient = createSupabaseMock({ user: null });
    await expect(markNotificationRead("n1")).rejects.toThrow(/must be signed in/);

    mockClient = createSupabaseMock({ user: null });
    await expect(markAllRead()).rejects.toThrow(/must be signed in/);
  });
});
