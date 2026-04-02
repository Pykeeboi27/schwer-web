import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loginAction,
  type LoginActionState,
} from "@/app/auth/login/actions";

const initialLoginActionState: LoginActionState = {
  error: null,
  success: false,
};

const mockSignInWithPassword = vi.fn();

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => ({
      auth: {
        signInWithPassword: mockSignInWithPassword,
      },
    }),
  };
});

describe("loginAction", () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
  });

  it("returns actionable state for unconfirmed email", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Email not confirmed" },
    });

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "secret");

    const result = await loginAction(initialLoginActionState, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Email not confirmed");
  });

  it("returns success for valid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "secret");

    const result = await loginAction(initialLoginActionState, formData);

    expect(result).toEqual({
      error: null,
      success: true,
    });
  });
});
