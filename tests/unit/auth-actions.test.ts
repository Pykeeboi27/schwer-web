import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import { loginAction } from "@/app/auth/login/actions";
import { signUpAction } from "@/app/auth/sign-up/actions";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

const initialLogin = { error: null, success: false };
const initialSignUp = { error: null, success: false };

describe("loginAction", () => {
  it("requires email and password", async () => {
    mockClient = createSupabaseMock();
    const result = await loginAction(initialLogin, formData({ email: "", password: "" }));
    expect(result).toEqual({
      error: "Email and password are required",
      success: false,
    });
  });

  it("normalizes the unconfirmed-email error", async () => {
    mockClient = createSupabaseMock({
      signInError: { message: "Email not confirmed" },
    });
    const result = await loginAction(
      initialLogin,
      formData({ email: "a@b.com", password: "secret" }),
    );
    expect(result).toEqual({ error: "Email not confirmed", success: false });
  });

  it("passes through other auth errors", async () => {
    mockClient = createSupabaseMock({
      signInError: { message: "Invalid login credentials" },
    });
    const result = await loginAction(
      initialLogin,
      formData({ email: "a@b.com", password: "wrong" }),
    );
    expect(result).toEqual({ error: "Invalid login credentials", success: false });
  });

  it("succeeds when credentials are valid", async () => {
    mockClient = createSupabaseMock({ user: { id: "u1" } });
    const result = await loginAction(
      initialLogin,
      formData({ email: "a@b.com", password: "secret" }),
    );
    expect(result).toEqual({ error: null, success: true });
  });
});

describe("signUpAction", () => {
  it("requires all fields", async () => {
    mockClient = createSupabaseMock();
    const result = await signUpAction(initialSignUp, formData({ email: "a@b.com" }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/);
  });

  it("rejects an unknown department", async () => {
    mockClient = createSupabaseMock();
    const result = await signUpAction(
      initialSignUp,
      formData({
        email: "a@b.com",
        password: "secret",
        repeatPassword: "secret",
        department: "aerospace",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Department must be one of/);
  });

  it("rejects mismatched passwords", async () => {
    mockClient = createSupabaseMock();
    const result = await signUpAction(
      initialSignUp,
      formData({
        email: "a@b.com",
        password: "secret",
        repeatPassword: "different",
        department: "sales",
      }),
    );
    expect(result).toEqual({ error: "Passwords do not match", success: false });
  });

  it("normalizes rate-limit errors from Supabase", async () => {
    mockClient = createSupabaseMock({
      signUpError: { message: "over_email_send_rate_limit reached" },
    });
    const result = await signUpAction(
      initialSignUp,
      formData({
        email: "a@b.com",
        password: "secret",
        repeatPassword: "secret",
        department: "sales",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Too many sign-up attempts/);
  });

  it("succeeds for a valid submission", async () => {
    mockClient = createSupabaseMock();
    const result = await signUpAction(
      initialSignUp,
      formData({
        email: "a@b.com",
        password: "secret",
        repeatPassword: "secret",
        department: "engineering",
      }),
    );
    expect(result).toEqual({ error: null, success: true });
  });
});
