import { describe, expect, it } from "vitest";

import { getPostAuthRedirectPath } from "@/lib/profile/redirect-to-dashboard";

describe("protected redirect behavior", () => {
  it("routes users without department to choose-department and preserves redirectTo", () => {
    expect(
      getPostAuthRedirectPath(
        {
          id: "u1",
          email: "user@example.com",
          department: null,
          isActive: true,
        },
        "/protected/hr?tab=reports",
      ),
    ).toBe("/auth/choose-department?redirectTo=%2Fprotected%2Fhr%3Ftab%3Dreports");
  });

  it("routes users with a department to the intended protected destination", () => {
    expect(
      getPostAuthRedirectPath(
        {
          id: "u1",
          email: "user@example.com",
          department: "engineering",
          isActive: true,
        },
        "/protected/hr?tab=reports",
      ),
    ).toBe("/protected/hr?tab=reports");
  });

  it("converges from onboarding to intended protected destination", () => {
    const intendedPath = "/protected/engineering?tab=overview";
    const onboardingRedirect = getPostAuthRedirectPath(
      {
        id: "u1",
        email: "user@example.com",
        department: null,
        isActive: true,
      },
      intendedPath,
    );

    expect(onboardingRedirect).toBe(
      "/auth/choose-department?redirectTo=%2Fprotected%2Fengineering%3Ftab%3Doverview",
    );

    const postOnboardingRedirect = getPostAuthRedirectPath(
      {
        id: "u1",
        email: "user@example.com",
        department: "engineering",
        isActive: true,
      },
      intendedPath,
    );

    expect(postOnboardingRedirect).toBe(intendedPath);
  });
});