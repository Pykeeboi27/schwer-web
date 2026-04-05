import { describe, expect, it } from "vitest";

import type { CurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";

describe("sales deep-link redirect behavior", () => {
  it("redirects anonymous users to login", () => {
    expect(getSalesAccessRedirect(null, "/protected/sales")).toBe("/auth/login");
  });

  it("redirects non-sales users from dashboard to their department route", () => {
    const profile: CurrentProfile = {
      id: "u1",
      email: "eng@example.com",
      department: "engineering",
      isActive: true,
      role: "engineer",
    };

    expect(getSalesAccessRedirect(profile, "/protected/sales")).toBe(
      "/protected/engineering",
    );
  });

  it("allows executive approvers into quotations tab", () => {
    const profile: CurrentProfile = {
      id: "u2",
      email: "owner@example.com",
      department: "executive",
      isActive: true,
      role: "owner",
    };

    expect(getSalesAccessRedirect(profile, "/protected/sales/quotations")).toBeNull();
  });
});
