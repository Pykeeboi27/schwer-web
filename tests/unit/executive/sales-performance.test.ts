import { describe, expect, it } from "vitest";

import {
  buildSalesPerformanceFromRows,
  type PurchaseOrderMetricRow,
} from "@/lib/executive/dashboard";

describe("executive sales performance helpers", () => {
  it("ranks owners by booked revenue and applies tie-break on owner name", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: "owner-a",
        po_amount: 250,
        margin_amount: 50,
        po_date: "2026-01-10",
        quotation_id: null,
      },
      {
        created_by: "owner-b",
        po_amount: 400,
        margin_amount: 120,
        po_date: "2026-01-11",
        quotation_id: null,
      },
      {
        created_by: "owner-c",
        po_amount: 250,
        margin_amount: 40,
        po_date: "2026-01-12",
        quotation_id: null,
      },
    ];

    const names = new Map<string, string>([
      ["owner-a", "Aimee"],
      ["owner-b", "Brian"],
      ["owner-c", "Cesar"],
    ]);

    const result = buildSalesPerformanceFromRows(rows, names);

    expect(result.map((entry) => entry.ownerName)).toEqual(["Brian", "Aimee", "Cesar"]);
    expect(result[0].bookedRevenue).toBe(400);
    // Brian: 120 / 400 = 30%, Aimee: 50 / 250 = 20%, Cesar: 40 / 250 = 16%.
    expect(result.map((entry) => entry.marginPercentAverage)).toEqual([30, 20, 16]);
  });

  it("uses fallback labels when owner name cannot be resolved", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: null,
        po_amount: 100,
        margin_amount: 10,
        po_date: "2026-02-01",
        quotation_id: null,
      },
      {
        created_by: "abc12345-ffff",
        po_amount: 200,
        margin_amount: 20,
        po_date: "2026-02-02",
        quotation_id: null,
      },
    ];

    const result = buildSalesPerformanceFromRows(rows, new Map());

    expect(result.find((entry) => entry.ownerId === "unassigned")?.ownerName).toBe(
      "Unassigned",
    );
    expect(result.find((entry) => entry.ownerId === "abc12345-ffff")?.ownerName).toBe(
      "Unknown",
    );
  });

  it("seeds every roster owner at zero revenue so inactive salespeople still appear", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: "owner-a",
        po_amount: 500,
        margin_amount: 50,
        po_date: "2026-03-01",
        quotation_id: null,
      },
    ];

    const names = new Map<string, string>([["owner-a", "aimee"]]);
    const roster = [
      { ownerId: "owner-a", ownerName: "aimee" },
      { ownerId: "owner-b", ownerName: "brian" },
    ];

    const result = buildSalesPerformanceFromRows(rows, names, roster);

    expect(result.map((entry) => entry.ownerName)).toEqual(["aimee", "brian"]);
    expect(result.find((entry) => entry.ownerId === "owner-b")?.bookedRevenue).toBe(0);
  });

  it("weights margin by PO value (Σ margin / Σ PO amount), not a mean of per-PO percentages", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: "owner-a",
        po_amount: 1000,
        margin_amount: 150,
        po_date: "2026-04-01",
        margin_percentage: 15,
        quotation_id: null,
      },
      {
        created_by: "owner-a",
        po_amount: 100,
        margin_amount: 5,
        po_date: "2026-04-02",
        margin_percentage: 5,
        quotation_id: null,
      },
    ];

    const result = buildSalesPerformanceFromRows(rows, new Map([["owner-a", "Aimee"]]));

    // (150 + 5) / (1000 + 100) = 14.09% -- the large PO dominates, matching the
    // Avg. Overall Margin card, instead of the simple mean (15 + 5) / 2 = 10.
    expect(
      result.find((entry) => entry.ownerId === "owner-a")?.marginPercentAverage,
    ).toBe(14.09);
  });

  it("attributes a PO to its linked quotation's sales_person_id, not its own created_by", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: "coordinator-1",
        po_amount: 300,
        margin_amount: 0,
        po_date: "2026-06-01",
        quotation_id: "q-1",
        quotations: { sales_person_id: "owner-a" },
      },
    ];

    const names = new Map<string, string>([["owner-a", "Aimee"]]);
    const result = buildSalesPerformanceFromRows(rows, names);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ ownerId: "owner-a", bookedRevenue: 300 });
    expect(result.some((entry) => entry.ownerId === "coordinator-1")).toBe(false);
  });

  it("ignores the stored margin_percentage and returns null for an owner with no revenue", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: "owner-a",
        po_amount: 1000,
        margin_amount: 200,
        po_date: "2026-05-01",
        margin_percentage: 20,
        quotation_id: null,
      },
      {
        created_by: "owner-a",
        po_amount: 500,
        margin_amount: 50,
        po_date: "2026-05-02",
        margin_percentage: null,
        quotation_id: null,
      },
    ];

    const result = buildSalesPerformanceFromRows(
      rows,
      new Map([
        ["owner-a", "Aimee"],
        ["owner-b", "Brian"],
      ]),
      [{ ownerId: "owner-b", ownerName: "Brian" }],
    );

    // (200 + 50) / (1000 + 500) = 16.67%, regardless of the stored percentages.
    expect(
      result.find((entry) => entry.ownerId === "owner-a")?.marginPercentAverage,
    ).toBe(16.67);
    expect(
      result.find((entry) => entry.ownerId === "owner-b")?.marginPercentAverage,
    ).toBeNull();
  });
});
