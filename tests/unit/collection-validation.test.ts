import { describe, expect, it } from "vitest";

import { assertCollectionDoesNotExceedPo } from "@/lib/sales/purchase-orders";

describe("collection validation", () => {
  it("allows collection totals up to PO amount", () => {
    expect(() => assertCollectionDoesNotExceedPo(1_000, 0)).not.toThrow();
    expect(() => assertCollectionDoesNotExceedPo(1_000, 1_000)).not.toThrow();
  });

  it("rejects collection totals beyond PO amount", () => {
    expect(() => assertCollectionDoesNotExceedPo(1_000, 1_001)).toThrow(/cannot exceed/i);
  });
});
