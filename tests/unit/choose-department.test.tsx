import { describe, expect, it } from "vitest";

import { validateDepartmentSelection } from "@/app/auth/choose-department/page";

describe("validateDepartmentSelection", () => {
  it("returns null for valid department", () => {
    expect(validateDepartmentSelection("engineering")).toBeNull();
  });

  it("returns error for invalid department", () => {
    expect(validateDepartmentSelection("marketing")).toContain("Department must be one of");
  });
});
