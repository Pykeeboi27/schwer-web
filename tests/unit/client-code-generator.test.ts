import { describe, expect, it } from "vitest";

import { generateClientCode } from "@/lib/utils/client-code-generator";

describe("generateClientCode", () => {
  it("returns code with C prefix and 6 digits", () => {
    const code = generateClientCode();

    expect(code).toMatch(/^C\d{6}$/);
  });

  it("produces multiple distinct values across repeated calls", () => {
    const codes = new Set(Array.from({ length: 25 }, () => generateClientCode()));

    expect(codes.size).toBeGreaterThan(1);
  });
});
