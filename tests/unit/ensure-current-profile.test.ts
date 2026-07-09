import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import { ensureCurrentProfile } from "@/lib/profile/ensure-current-profile";

const profileRow = {
  id: "u1",
  email: "user@example.com",
  department: "engineering",
  is_active: true,
  role: null,
  is_executive_viewer: false,
};

describe("ensureCurrentProfile", () => {
  it("returns null when there are no claims", async () => {
    mockClient = createSupabaseMock({ claims: null });
    await expect(ensureCurrentProfile()).resolves.toBeNull();
  });

  it("returns null when getClaims errors", async () => {
    mockClient = createSupabaseMock({
      claims: { sub: "u1" },
      claimsError: { message: "bad token" },
    });
    await expect(ensureCurrentProfile()).resolves.toBeNull();
  });

  it("returns the mapped profile when one already exists", async () => {
    mockClient = createSupabaseMock({
      claims: { sub: "u1", email: "user@example.com" },
      tables: { profiles: { data: profileRow, error: null } },
    });

    await expect(ensureCurrentProfile()).resolves.toEqual({
      id: "u1",
      email: "user@example.com",
      department: "engineering",
      isActive: true,
      role: null,
      isExecutiveViewer: false,
    });
  });

  it("throws when the profile lookup errors", async () => {
    mockClient = createSupabaseMock({
      claims: { sub: "u1", email: "user@example.com" },
      tables: { profiles: { data: null, error: { message: "db down" } } },
    });

    await expect(ensureCurrentProfile()).rejects.toThrow(/couldn't load your profile/i);
  });

  it("self-heals by creating a profile row when none exists (cold path)", async () => {
    mockClient = createSupabaseMock({
      claims: { sub: "u1", email: "new@example.com" },
      tables: {
        profiles: [
          { data: null, error: null }, // initial maybeSingle: no profile yet
          { data: null, error: null }, // upsert
          {
            data: { ...profileRow, id: "u1", email: "new@example.com", department: null },
            error: null,
          }, // repaired single()
        ],
      },
    });

    await expect(ensureCurrentProfile()).resolves.toEqual({
      id: "u1",
      email: "new@example.com",
      department: null,
      isActive: true,
      role: null,
      isExecutiveViewer: false,
    });
  });

  it("throws when claims have no email to seed a new profile", async () => {
    mockClient = createSupabaseMock({
      claims: { sub: "u1" },
      tables: { profiles: { data: null, error: null } },
    });

    await expect(ensureCurrentProfile()).rejects.toThrow(/couldn't load your profile/i);
  });

  it("throws when the upsert fails", async () => {
    mockClient = createSupabaseMock({
      claims: { sub: "u1", email: "new@example.com" },
      tables: {
        profiles: [
          { data: null, error: null },
          { data: null, error: { message: "insert failed" } },
        ],
      },
    });

    await expect(ensureCurrentProfile()).rejects.toThrow(/couldn't load your profile/i);
  });

  it("throws when the repaired profile cannot be re-fetched", async () => {
    mockClient = createSupabaseMock({
      claims: { sub: "u1", email: "new@example.com" },
      tables: {
        profiles: [
          { data: null, error: null },
          { data: null, error: null },
          { data: null, error: { message: "not found" } },
        ],
      },
    });

    await expect(ensureCurrentProfile()).rejects.toThrow(/couldn't load your profile/i);
  });
});
