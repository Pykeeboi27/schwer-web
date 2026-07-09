import { afterEach, beforeEach, describe, expect, it } from "vitest";

// env.ts reads process.env at module-load time, so each scenario needs a fresh
// module instance (vi.resetModules) after setting process.env, rather than a
// single static import.

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("lib/supabase/env", () => {
  it("hasSupabaseEnv is false and getSupabaseEnv throws when no env vars are set", async () => {
    const { hasSupabaseEnv, getSupabaseEnv } = await import("@/lib/supabase/env");

    expect(hasSupabaseEnv).toBe(false);
    expect(() => getSupabaseEnv()).toThrow(/Missing Supabase env vars/);
  });

  it("hasSupabaseEnv is false when only the URL is set", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const { hasSupabaseEnv, getSupabaseEnv } = await import("@/lib/supabase/env");

    expect(hasSupabaseEnv).toBe(false);
    expect(() => getSupabaseEnv()).toThrow(/Missing Supabase env vars/);
  });

  it("resolves the publishable key from NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const { hasSupabaseEnv, getSupabaseEnv } = await import("@/lib/supabase/env");

    expect(hasSupabaseEnv).toBe(true);
    expect(getSupabaseEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-key",
    });
  });

  it("falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY when the publishable key is absent", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const { getSupabaseEnv } = await import("@/lib/supabase/env");

    expect(getSupabaseEnv().supabasePublishableKey).toBe("anon-key");
  });

  it("falls back to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as a last resort", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "default-key";
    const { getSupabaseEnv } = await import("@/lib/supabase/env");

    expect(getSupabaseEnv().supabasePublishableKey).toBe("default-key");
  });
});
