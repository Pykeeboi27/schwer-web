import { describe, expect, it } from "vitest";

import {
  buildAverageCostingToPoDaysFromRows,
  computeQuotaPercent,
  validateQuotaAmountInput,
} from "@/lib/executive/quotas";
import { getQuotationAging } from "@/lib/sales/quotation-aging";

// PO-to-salesperson attribution (attributeBookedRevenue / resolveBookedOwnerId)
// now lives in lib/sales/booked-revenue.ts -- see tests/unit/booked-revenue.test.ts.

describe("computeQuotaPercent", () => {
  it("returns null when no quota is set", () => {
    expect(computeQuotaPercent(50_000, null)).toBeNull();
  });

  it("returns null for a zero or negative quota", () => {
    expect(computeQuotaPercent(50_000, 0)).toBeNull();
  });

  it("computes partial progress", () => {
    expect(computeQuotaPercent(250_000, 1_000_000)).toBe(25);
  });

  it("does not clamp progress over 100%", () => {
    expect(computeQuotaPercent(1_500_000, 1_000_000)).toBe(150);
  });
});

describe("validateQuotaAmountInput", () => {
  it("accepts a non-negative finite number", () => {
    expect(validateQuotaAmountInput(500_000)).toBe(500_000);
  });

  it("rejects negative amounts", () => {
    expect(() => validateQuotaAmountInput(-1)).toThrow(/non-negative/);
  });

  it("rejects non-finite amounts", () => {
    expect(() => validateQuotaAmountInput(Number.NaN)).toThrow(/non-negative/);
  });
});

describe("buildAverageCostingToPoDaysFromRows", () => {
  it("returns null when there are no rows", () => {
    expect(buildAverageCostingToPoDaysFromRows([])).toBeNull();
  });

  it("averages the day gap across rows", () => {
    const rows = [
      {
        costing_approved_at: "2026-01-01T00:00:00Z",
        po_converted_at: "2026-01-05T00:00:00Z",
      },
      {
        costing_approved_at: "2026-01-01T00:00:00Z",
        po_converted_at: "2026-01-11T00:00:00Z",
      },
    ];

    expect(buildAverageCostingToPoDaysFromRows(rows)).toBe(7);
  });
});

describe("getQuotationAging", () => {
  const now = new Date("2026-01-20T00:00:00Z");

  it("returns null when costing hasn't been approved yet", () => {
    expect(getQuotationAging(null, null, now)).toBeNull();
  });

  it("counts up to now while the quotation hasn't converted to a PO", () => {
    const aging = getQuotationAging("2026-01-10T00:00:00Z", null, now);
    expect(aging).toEqual({ days: 10, isOpen: true });
  });

  it("freezes the count at the PO conversion date once converted", () => {
    const aging = getQuotationAging("2026-01-01T00:00:00Z", "2026-01-04T00:00:00Z", now);
    expect(aging).toEqual({ days: 3, isOpen: false });
  });
});
