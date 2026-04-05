import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureCurrentProfile } from "@/lib/profile/ensure-current-profile";

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => ({
      auth: {
        getUser: mockGetUser,
      },
      from: () => ({
        select: mockSelect,
      }),
    }),
  };
});

describe("ensureCurrentProfile unit", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockMaybeSingle.mockReset();

    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });
  });

  it("returns mapped profile data", async () => {
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
  });
});