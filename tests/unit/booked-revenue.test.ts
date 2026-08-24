import { describe, expect, it } from "vitest";

import {
  attributeBookedRevenue,
  resolveBookedOwnerId,
  sumBookedRevenue,
  UNATTRIBUTED_OWNER_ID,
  type BookedPoRow,
} from "@/lib/sales/booked-revenue";

function row(overrides: Partial<BookedPoRow> = {}): BookedPoRow {
  return {
    po_amount: 0,
    po_date: "2026-01-01",
    created_by: null,
    quotation_id: null,
    ...overrides,
  };
}

describe("sumBookedRevenue", () => {
  it("sums po_amount across rows, coercing numeric strings", () => {
    const rows = [row({ po_amount: 100 }), row({ po_amount: "250" })];

    expect(sumBookedRevenue(rows)).toBe(350);
  });

  it("treats null/undefined/NaN po_amount as zero instead of throwing or producing NaN", () => {
    const rows = [
      row({ po_amount: null }),
      row({ po_amount: undefined as unknown as null }),
      row({ po_amount: "not-a-number" }),
      row({ po_amount: 100 }),
    ];

    expect(sumBookedRevenue(rows)).toBe(100);
  });

  it("returns zero for an empty row set", () => {
    expect(sumBookedRevenue([])).toBe(0);
  });
});

describe("resolveBookedOwnerId", () => {
  it("prefers the linked quotation's sales_person_id over created_by", () => {
    const r = row({
      created_by: "creator-1",
      quotations: { sales_person_id: "salesperson-1" },
    });

    expect(resolveBookedOwnerId(r)).toBe("salesperson-1");
  });

  it("unwraps an embedded-join array response the same way", () => {
    const r = row({
      created_by: "creator-1",
      quotations: [{ sales_person_id: "salesperson-1" }],
    });

    expect(resolveBookedOwnerId(r)).toBe("salesperson-1");
  });

  it("falls back to created_by when the linked quotation has no salesperson", () => {
    const r = row({ created_by: "creator-1", quotations: { sales_person_id: null } });

    expect(resolveBookedOwnerId(r)).toBe("creator-1");
  });

  it("falls back to created_by for a manually-encoded PO with no linked quotation", () => {
    const r = row({ created_by: "creator-1", quotations: null });

    expect(resolveBookedOwnerId(r)).toBe("creator-1");
  });

  it("falls back to UNATTRIBUTED_OWNER_ID when neither is set, instead of dropping the row", () => {
    const r = row({ created_by: null, quotations: null });

    expect(resolveBookedOwnerId(r)).toBe(UNATTRIBUTED_OWNER_ID);
  });
});

describe("attributeBookedRevenue", () => {
  it("buckets revenue per resolved owner", () => {
    const rows = [
      row({ po_amount: 100_000, quotations: { sales_person_id: "sp-1" } }),
      row({ po_amount: 200_000, created_by: "sp-1" }),
      row({ po_amount: 50_000, created_by: "sp-2" }),
    ];

    const totals = attributeBookedRevenue(rows);

    expect(totals.get("sp-1")).toBe(300_000);
    expect(totals.get("sp-2")).toBe(50_000);
  });

  it("never drops a row: bucket totals always sum to sumBookedRevenue", () => {
    const rows = [
      row({ po_amount: 100_000, quotations: { sales_person_id: "sp-1" } }),
      row({ po_amount: 25_000, created_by: null, quotation_id: null }),
      row({ po_amount: 10_000 }),
    ];

    const totals = attributeBookedRevenue(rows);
    const bucketSum = Array.from(totals.values()).reduce((a, b) => a + b, 0);

    expect(bucketSum).toBe(sumBookedRevenue(rows));
    expect(totals.get(UNATTRIBUTED_OWNER_ID)).toBe(35_000);
  });
});
