import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({
    className: "geist-mock",
  }),
}));

describe("app metadata", () => {
  it("uses Schwer Online Management branding", async () => {
    const { metadata } = await import("@/app/layout");

    expect(metadata.title).toBe("Schwer Online Management");
    expect(metadata.description).toContain("Schwer Online Management");
  });
});