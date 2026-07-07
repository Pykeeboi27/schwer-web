import { describe, expect, it, vi } from "vitest";

import {
  generateClientCode,
  generateUniqueClientCode,
} from "@/lib/utils/client-code-generator";

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

describe("generateUniqueClientCode", () => {
  it("returns the first candidate when it is unique", async () => {
    const isCodeUnique = vi.fn().mockResolvedValue(true);

    const code = await generateUniqueClientCode(isCodeUnique);

    expect(code).toMatch(/^C\d{6}$/);
    expect(isCodeUnique).toHaveBeenCalledTimes(1);
  });

  it("retries until it finds a unique candidate", async () => {
    const isCodeUnique = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    const code = await generateUniqueClientCode(isCodeUnique);

    expect(code).toMatch(/^C\d{6}$/);
    expect(isCodeUnique).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting the maximum number of attempts", async () => {
    const isCodeUnique = vi.fn().mockResolvedValue(false);

    await expect(generateUniqueClientCode(isCodeUnique, 3)).rejects.toThrow(
      /unique client code/i,
    );
    expect(isCodeUnique).toHaveBeenCalledTimes(3);
  });
});
