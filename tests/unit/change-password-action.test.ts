import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockServerClient: SupabaseMock = createSupabaseMock();
let mockVerifyClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockServerClient,
}));

vi.mock("@/lib/supabase/verify-client", () => ({
  createVerificationClient: () => mockVerifyClient,
}));

import { changePasswordAction } from "@/app/protected/account/actions";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

const initialState = { error: null, success: false };

const loggedInUser = { id: "u1", email: "real@x.com" };

describe("changePasswordAction", () => {
  it("requires all fields", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({ currentPassword: "", newPassword: "", confirmPassword: "" }),
    );

    expect(result).toEqual({
      error: "All password fields are required",
      success: false,
    });
  });

  it("rejects mismatched new/confirm passwords", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "different",
      }),
    );

    expect(result).toEqual({
      error: "New passwords do not match",
      success: false,
    });
  });

  it("rejects a new password identical to the current one", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "same-pass",
        newPassword: "same-pass",
        confirmPassword: "same-pass",
      }),
    );

    expect(result).toEqual({
      error: "New password must be different from your current password",
      success: false,
    });
  });

  it("requires an active session", async () => {
    mockServerClient = createSupabaseMock({ claims: null });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(result).toEqual({
      error: "Your session has expired. Please sign in again",
      success: false,
    });
    expect(mockVerifyClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password without leaking login wording, and never applies the update", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock({
      signInError: { message: "Invalid login credentials" },
    });

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "wrong-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(result).toEqual({
      error: "Current password is incorrect",
      success: false,
    });
    expect(result.error).not.toMatch(/login/i);
    expect(mockServerClient.auth.updateUser).not.toHaveBeenCalled();
  });

  it("verifies against the server session's email, ignoring any email submitted in the form", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock();

    await changePasswordAction(
      initialState,
      formData({
        email: "victim@y.com",
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(mockVerifyClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "real@x.com",
      password: "old-pass",
    });
  });

  it("surfaces Supabase's own password-policy message verbatim", async () => {
    mockServerClient = createSupabaseMock({
      user: loggedInUser,
      updateUserError: { message: "Password should be at least 8 characters." },
    });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "short",
        confirmPassword: "short",
      }),
    );

    expect(result).toEqual({
      error: "Password should be at least 8 characters.",
      success: false,
    });
  });

  it("normalizes a same-password rejection from Supabase", async () => {
    mockServerClient = createSupabaseMock({
      user: loggedInUser,
      updateUserError: {
        message: "New password should be different from the old password.",
      },
    });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(result.error).toBe(
      "New password must be different from your current password",
    );
  });

  it("normalizes a reauthentication-required rejection from Supabase", async () => {
    mockServerClient = createSupabaseMock({
      user: loggedInUser,
      updateUserError: { message: "reauthentication_needed" },
    });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(result.error).toMatch(/re-enabled|administrator/);
  });

  it("normalizes a rate-limit error from the verification step", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock({
      signInError: { message: "Request rate limit reached" },
    });

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(result.error).toMatch(/Too many attempts/);
  });

  it("succeeds and only locally signs out the throwaway verification session", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock();

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(result).toEqual({ error: null, success: true });
    expect(mockServerClient.auth.updateUser).toHaveBeenCalledWith({
      password: "new-pass",
    });
    expect(mockVerifyClient.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mockServerClient.auth.signOut).not.toHaveBeenCalled();
  });

  it("still reports success even if the post-update cleanup sign-out throws", async () => {
    mockServerClient = createSupabaseMock({ user: loggedInUser });
    mockVerifyClient = createSupabaseMock();
    mockVerifyClient.auth.signOut = vi.fn(async () => {
      throw new Error("session already revoked");
    });

    const result = await changePasswordAction(
      initialState,
      formData({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    );

    expect(result).toEqual({ error: null, success: true });
  });
});
