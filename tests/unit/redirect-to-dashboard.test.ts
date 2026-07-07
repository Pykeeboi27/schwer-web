import { describe, expect, it } from "vitest";

import type { CurrentProfile } from "@/lib/profile/get-current-profile";
import {
  getDepartmentDashboardPath,
  getPostAuthRedirectPath,
  isSafeProtectedRedirectTarget,
} from "@/lib/profile/redirect-to-dashboard";

const profile: CurrentProfile = {
  id: "u1",
  email: "u@example.com",
  department: "sales",
  isActive: true,
};

describe("getDepartmentDashboardPath", () => {
  it("builds a protected department path", () => {
    expect(getDepartmentDashboardPath("engineering")).toBe("/protected/engineering");
  });
});

describe("isSafeProtectedRedirectTarget", () => {
  it("accepts only in-app protected targets", () => {
    expect(isSafeProtectedRedirectTarget("/protected")).toBe(true);
    expect(isSafeProtectedRedirectTarget("/protected/sales")).toBe(true);
    expect(isSafeProtectedRedirectTarget("/protected?tab=1")).toBe(true);
    expect(isSafeProtectedRedirectTarget("/protectedx")).toBe(false);
    expect(isSafeProtectedRedirectTarget("https://evil.com/protected")).toBe(false);
    expect(isSafeProtectedRedirectTarget(null)).toBe(false);
    expect(isSafeProtectedRedirectTarget(undefined)).toBe(false);
  });
});

describe("getPostAuthRedirectPath", () => {
  it("sends users without a department to choose-department, preserving a safe redirect", () => {
    expect(getPostAuthRedirectPath(null)).toBe("/auth/choose-department");
    expect(getPostAuthRedirectPath({ ...profile, department: null })).toBe(
      "/auth/choose-department",
    );
    expect(
      getPostAuthRedirectPath({ ...profile, department: null }, "/protected/sales"),
    ).toBe("/auth/choose-department?redirectTo=%2Fprotected%2Fsales");
  });

  it("honors a safe redirect target that is not the bare /protected root", () => {
    expect(getPostAuthRedirectPath(profile, "/protected/sales/quotations")).toBe(
      "/protected/sales/quotations",
    );
  });

  it("falls back to the department dashboard for the bare /protected or unsafe targets", () => {
    expect(getPostAuthRedirectPath(profile, "/protected")).toBe("/protected/sales");
    expect(getPostAuthRedirectPath(profile, "https://evil.com")).toBe("/protected/sales");
    expect(getPostAuthRedirectPath(profile)).toBe("/protected/sales");
  });
});
