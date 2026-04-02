import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  signUpAction,
  type SignUpActionState,
} from "@/app/auth/sign-up/actions";

const initialSignUpActionState: SignUpActionState = {
  error: null,
  success: false,
};

const mockSignUp = vi.fn();

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => ({
      auth: {
        signUp: mockSignUp,
      },
    }),
  };
});

describe("signUpAction", () => {
  beforeEach(() => {
    mockSignUp.mockReset();
  });

  it("sends department metadata", async () => {
    mockSignUp.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", "new.user@example.com");
    formData.set("password", "secret123");
    formData.set("repeatPassword", "secret123");
    formData.set("department", "engineering");

    const result = await signUpAction(initialSignUpActionState, formData);

    expect(result).toEqual({ error: null, success: true });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "new.user@example.com",
      password: "secret123",
      options: {
        data: {
          department: "engineering",
        },
      },
    });
  });

  it("fails when passwords do not match", async () => {
    const formData = new FormData();
    formData.set("email", "new.user@example.com");
    formData.set("password", "secret123");
    formData.set("repeatPassword", "different");
    formData.set("department", "engineering");

    const result = await signUpAction(initialSignUpActionState, formData);

    expect(result).toEqual({
      error: "Passwords do not match",
      success: false,
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("maps email rate limit errors to actionable guidance", async () => {
    mockSignUp.mockResolvedValue({
      error: { message: "email rate limit exceeded" },
    });

    const formData = new FormData();
    formData.set("email", "new.user@example.com");
    formData.set("password", "secret123");
    formData.set("repeatPassword", "secret123");
    formData.set("department", "engineering");

    const result = await signUpAction(initialSignUpActionState, formData);

    expect(result).toEqual({
      error:
        "Too many sign-up attempts in a short time. Please wait a minute and try again, or use a different email during testing.",
      success: false,
    });
  });
});
