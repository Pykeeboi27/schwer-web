import { describe, expect, it } from "vitest";

import { validateAnnualTargetInput } from "@/lib/executive/targets";

describe("executive target validation", () => {
  it("accepts non-negative values", () => {
    expect(validateAnnualTargetInput(0)).toBe(0);
    expect(validateAnnualTargetInput(1500000.25)).toBe(1500000.25);
  });

  it("rejects negative and invalid values", () => {
    expect(() => validateAnnualTargetInput(-1)).toThrow(/non-negative/);
    expect(() => validateAnnualTargetInput(Number.NaN)).toThrow(/non-negative/);
  });
});
