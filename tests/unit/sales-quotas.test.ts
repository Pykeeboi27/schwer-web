import { describe, expect, it } from "vitest";

import {
  attributePurchaseOrdersToSalesPerson,
  buildAverageCostingToPoDaysFromRows,
  computeQuotaPercent,
  validateQuotaAmountInput,
} from "@/lib/executive/quotas";
import { getQuotationAging } from "@/lib/sales/quotation-aging";

describe("attributePurchaseOrdersToSalesPerson", () => {
  it("attributes a PO to its linked quotation's salesperson", () => {
    const rows = [{ po_amount: 100_000, created_by: "creator-1", quotation_id: "q-1" }];
    const quotationSalesPersonMap = new Map([["q-1", "salesperson-1"]]);

    const totals = attributePurchaseOrdersToSalesPerson(rows, quotationSalesPersonMap);

    expect(totals.get("salesperson-1")).toBe(100_000);
    expect(totals.has("creator-1")).toBe(false);
  });

  it("falls back to the PO's created_by when the linked quotation has no salesperson", () => {
    const rows = [{ po_amount: 50_000, created_by: "creator-1", quotation_id: "q-1" }];
    const quotationSalesPersonMap = new Map([["q-1", null]]);

    const totals = attributePurchaseOrdersToSalesPerson(rows, quotationSalesPersonMap);

    expect(totals.get("creator-1")).toBe(50_000);
  });

  it("falls back to created_by for manual POs with no linked quotation", () => {
    const rows = [{ po_amount: 75_000, created_by: "creator-1", quotation_id: null }];

    const totals = attributePurchaseOrdersToSalesPerson(rows, new Map());

    expect(totals.get("creator-1")).toBe(75_000);
  });

  it("sums multiple POs attributed to the same salesperson", () => {
    const rows = [
      { po_amount: 100_000, created_by: "creator-1", quotation_id: "q-1" },
      { po_amount: 200_000, created_by: "creator-2", quotation_id: "q-2" },
    ];
    const quotationSalesPersonMap = new Map([
      ["q-1", "salesperson-1"],
      ["q-2", "salesperson-1"],
    ]);

    const totals = attributePurchaseOrdersToSalesPerson(rows, quotationSalesPersonMap);

    expect(totals.get("salesperson-1")).toBe(300_000);
  });

  it("skips POs with neither a quotation owner nor a created_by", () => {
    const rows = [{ po_amount: 10_000, created_by: null, quotation_id: null }];

    const totals = attributePurchaseOrdersToSalesPerson(rows, new Map());

    expect(totals.size).toBe(0);
  });
});

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
