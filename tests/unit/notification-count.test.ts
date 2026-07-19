import { describe, expect, it } from "vitest";

import { formatRelativeTime, formatUnreadCount } from "@/lib/notifications/links";

describe("formatUnreadCount", () => {
  it("hides the badge at zero", () => {
    expect(formatUnreadCount(0)).toBeNull();
  });

  it("shows the exact count under 10", () => {
    expect(formatUnreadCount(1)).toBe("1");
    expect(formatUnreadCount(9)).toBe("9");
  });

  it("caps the display at 9+ once over 9", () => {
    expect(formatUnreadCount(10)).toBe("9+");
    expect(formatUnreadCount(42)).toBe("9+");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  it("shows 'Just now' for anything under a minute old", () => {
    expect(formatRelativeTime("2026-07-18T11:59:59.000Z", now)).toBe("Just now");
  });

  it("shows minutes for under an hour", () => {
    expect(formatRelativeTime("2026-07-18T11:55:00.000Z", now)).toBe("5m ago");
  });

  it("shows hours for under a day", () => {
    expect(formatRelativeTime("2026-07-18T09:00:00.000Z", now)).toBe("3h ago");
  });

  it("shows days for under a week", () => {
    expect(formatRelativeTime("2026-07-16T12:00:00.000Z", now)).toBe("2d ago");
  });

  it("falls back to a calendar date for a week or older", () => {
    expect(formatRelativeTime("2026-07-01T12:00:00.000Z", now)).toBe("Jul 1");
  });
});
