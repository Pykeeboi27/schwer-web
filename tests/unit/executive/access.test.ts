import { describe, expect, it } from "vitest";

import type { CurrentProfile } from "@/lib/profile/get-current-profile";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";

describe("executive access redirect helper", () => {
  it("allows active executive viewers", () => {
    const profile: CurrentProfile = {
      id: "viewer-1",
      email: "viewer@example.com",
      department: "executive",
      isActive: true,
      role: "executive",
      isExecutiveViewer: true,
    };

    expect(getExecutiveAccessRedirect(profile, "/protected/executive")).toBeNull();
  });

  it("allows active executive owner/executive roles even if viewer flag is false", () => {
    const profile: CurrentProfile = {
      id: "non-viewer-1",
      email: "nonviewer@example.com",
      department: "executive",
      isActive: true,
      role: "executive",
      isExecutiveViewer: false,
    };

    expect(getExecutiveAccessRedirect(profile, "/protected/executive")).toBeNull();
  });

  it("redirects unsupported executive-department roles to safe error path instead of looping", () => {
    const profile: CurrentProfile = {
      id: "non-viewer-2",
      email: "nonviewer2@example.com",
      department: "executive",
      isActive: true,
      role: "sales_staff",
      isExecutiveViewer: false,
    };

    const redirectPath = getExecutiveAccessRedirect(profile, "/protected/executive");

    expect(redirectPath).toContain("/auth/error?");
    expect(redirectPath).toContain("retry=%2Fprotected");
  });

  it("redirects non-executive viewers to their department dashboard", () => {
    const profile: CurrentProfile = {
      id: "sales-1",
      email: "sales@example.com",
      department: "sales",
      isActive: true,
      role: "sales_manager",
      isExecutiveViewer: false,
    };

    expect(getExecutiveAccessRedirect(profile, "/protected/executive")).toBe("/protected/sales");
  });

  it("redirects anonymous users to login", () => {
    expect(getExecutiveAccessRedirect(null, "/protected/executive")).toBe("/auth/login");
  });
});
