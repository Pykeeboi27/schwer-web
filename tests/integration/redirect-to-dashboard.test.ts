import { describe, expect, it } from "vitest";

import {
  getDepartmentDashboardPath,
  getPostAuthRedirectPath,
  isSafeProtectedRedirectTarget,
} from "@/lib/profile/redirect-to-dashboard";

describe("redirect-to-dashboard", () => {
  it("returns choose-department when profile is null", () => {
    expect(getPostAuthRedirectPath(null)).toBe("/auth/choose-department");
  });

  it("preserves safe redirectTo through choose-department when department is missing", () => {
    expect(
      getPostAuthRedirectPath(
        {
          id: "u1",
          email: "test@example.com",
          department: null,
          isActive: true,
        },
        "/protected/hr",
      ),
    ).toBe("/auth/choose-department?redirectTo=%2Fprotected%2Fhr");
  });

  it("returns choose-department when department is missing", () => {
    expect(
      getPostAuthRedirectPath({
        id: "u1",
        email: "test@example.com",
        department: null,
        isActive: true,
      }),
    ).toBe("/auth/choose-department");
  });

  it("returns department route when department is present", () => {
    expect(
      getPostAuthRedirectPath({
        id: "u1",
        email: "test@example.com",
        department: "engineering",
        isActive: true,
      }),
    ).toBe("/protected/engineering");
  });

  it("returns redirectTo for authenticated users with department", () => {
    expect(
      getPostAuthRedirectPath(
        {
          id: "u1",
          email: "test@example.com",
          department: "engineering",
          isActive: true,
        },
        "/protected/hr",
      ),
    ).toBe("/protected/hr");
  });

  it("rejects unsafe redirect targets", () => {
    expect(isSafeProtectedRedirectTarget("https://evil.example")).toBe(false);
    expect(isSafeProtectedRedirectTarget("/auth/login")).toBe(false);
    expect(isSafeProtectedRedirectTarget("/protected/hr")).toBe(true);
  });

  it("builds department dashboard path", () => {
    expect(getDepartmentDashboardPath("hr")).toBe("/protected/hr");
  });
});
