import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/confirm/route";

const mockExchangeCodeForSession = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => ({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    }),
  };
});

vi.mock("@/lib/profile/get-current-profile", () => {
  return {
    getCurrentProfile: vi.fn(async () => ({
      id: "u1",
      email: "user@example.com",
      department: null,
      isActive: true,
    })),
  };
});

vi.mock("next/navigation", () => {
  return {
    redirect: (url: string) => {
      mockRedirect(url);
      throw new Error("NEXT_REDIRECT");
    },
  };
});

describe("/auth/confirm", () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset();
    mockRedirect.mockReset();
  });

  it("redirects to choose-department when OAuth user has no department", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    await expect(
      GET({
        url: "http://localhost:3000/auth/confirm?code=oauth-code&next=/protected",
      } as never),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/auth/choose-department");
  });
});
