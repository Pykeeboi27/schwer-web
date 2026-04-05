import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/confirm/route";

const {
  mockExchangeCodeForSession,
  mockVerifyOtp,
  mockEnsureCurrentProfile,
  mockRedirect,
} = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockEnsureCurrentProfile: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => ({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        verifyOtp: mockVerifyOtp,
      },
    }),
  };
});

vi.mock("@/lib/profile/ensure-current-profile", () => {
  return {
    EnsureCurrentProfileError: class EnsureCurrentProfileError extends Error {},
    isEnsureCurrentProfileError: (error: unknown) =>
      error instanceof Error && error.name === "EnsureCurrentProfileError",
    ensureCurrentProfile: mockEnsureCurrentProfile,
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
    mockVerifyOtp.mockReset();
    mockEnsureCurrentProfile.mockReset();
    mockRedirect.mockReset();

    mockEnsureCurrentProfile.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      department: null,
      isActive: true,
    });
  });

  it("redirects to choose-department when OAuth user has no department", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    await expect(
      GET({
        url: "http://localhost:3000/auth/confirm?code=oauth-code&next=/protected",
      } as never),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/auth/choose-department?redirectTo=%2Fprotected");
  });

  it("redirects to auth error with retry when profile ensurement fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const ensureError = new Error("profile missing");
    ensureError.name = "EnsureCurrentProfileError";
    mockEnsureCurrentProfile.mockRejectedValue(ensureError);

    await expect(
      GET({
        url: "http://localhost:3000/auth/confirm?code=oauth-code&next=/protected/hr",
      } as never),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringMatching(/^\/auth\/error\?error=.*&retry=%2Fauth%2Flogin%3FredirectTo%3D/),
    );
  });
});
