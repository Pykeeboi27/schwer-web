import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureCurrentProfile,
  EnsureCurrentProfileError,
} from "@/lib/profile/ensure-current-profile";

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => ({
      auth: {
        getUser: mockGetUser,
      },
      from: () => ({
        select: mockSelect,
        upsert: mockUpsert,
      }),
    }),
  };
});

describe("ensureCurrentProfile", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockMaybeSingle.mockReset();
    mockSingle.mockReset();
    mockUpsert.mockReset();

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq
      .mockReturnValueOnce({
        maybeSingle: mockMaybeSingle,
      })
      .mockReturnValueOnce({
        single: mockSingle,
      });
  });

  it("returns null for unauthenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(ensureCurrentProfile()).resolves.toBeNull();
  });

  it("returns existing profile when present", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "u1",
        email: "user@example.com",
        department: "engineering",
        is_active: true,
      },
      error: null,
    });

    await expect(ensureCurrentProfile()).resolves.toEqual({
      id: "u1",
      email: "user@example.com",
      department: "engineering",
      isActive: true,
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts missing profile and re-fetches", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({
      data: {
        id: "u1",
        email: "user@example.com",
        department: null,
        is_active: true,
      },
      error: null,
    });

    await expect(ensureCurrentProfile()).resolves.toEqual({
      id: "u1",
      email: "user@example.com",
      department: null,
      isActive: true,
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: "u1",
        email: "user@example.com",
      },
      {
        onConflict: "id",
      },
    );
  });

  it("throws actionable profile error when upsert fails", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockUpsert.mockResolvedValue({
      error: { message: "insert blocked" },
    });

    await expect(ensureCurrentProfile()).rejects.toBeInstanceOf(EnsureCurrentProfileError);
  });
});