import { describe, expect, it } from "vitest";

import {
  assertCollectionDoesNotExceedPo,
  parsePoAmount,
} from "@/lib/sales/purchase-orders";

describe("sales PO payment validation", () => {
  it("accepts valid PO amount", () => {
    expect(parsePoAmount("1500.50")).toBe(1500.5);
  });

  it("rejects PO amount with invalid precision or length", () => {
    expect(() => parsePoAmount("100.999")).toThrow(/up to 2 decimal places/i);
    expect(() => parsePoAmount("1234567890123456")).toThrow(/up to 15 digits/i);
  });

  it("rejects over-collection", () => {
    expect(() => assertCollectionDoesNotExceedPo(1000, 1200)).toThrow(
      /cannot exceed/i,
    );
  });

  it("allows collection up to PO amount", () => {
    expect(() => assertCollectionDoesNotExceedPo(1000, 1000)).not.toThrow();
  });
});
