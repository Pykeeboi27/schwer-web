import { describe, expect, it } from "vitest";

import {
  buildSalesPerformanceFromRows,
  type PurchaseOrderMetricRow,
} from "@/lib/executive/dashboard";

describe("executive sales performance helpers", () => {
  it("ranks owners by booked revenue and applies tie-break on owner name", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { created_by: "owner-a", po_amount: 250, margin_amount: 50, po_date: "2026-01-10" },
      {
        created_by: "owner-b",
        po_amount: 400,
        margin_amount: 120,
        po_date: "2026-01-11",
      },
      { created_by: "owner-c", po_amount: 250, margin_amount: 40, po_date: "2026-01-12" },
    ];

    const names = new Map<string, string>([
      ["owner-a", "Aimee"],
      ["owner-b", "Brian"],
      ["owner-c", "Cesar"],
    ]);

    const result = buildSalesPerformanceFromRows(rows, names);

    expect(result.map((entry) => entry.ownerName)).toEqual(["Brian", "Aimee", "Cesar"]);
    expect(result[0].bookedRevenue).toBe(400);
    // None of the fixture rows carry a margin_percentage -> average stays null (N/A),
    // rather than silently collapsing to 0.
    expect(result.every((entry) => entry.marginPercentAverage === null)).toBe(true);
  });

  it("uses fallback labels when owner name cannot be resolved", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { created_by: null, po_amount: 100, margin_amount: 10, po_date: "2026-02-01" },
      {
        created_by: "abc12345-ffff",
        po_amount: 200,
        margin_amount: 20,
        po_date: "2026-02-02",
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
      { created_by: "owner-a", po_amount: 500, margin_amount: 50, po_date: "2026-03-01" },
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

  it("averages margin_percentage as a simple (unweighted) mean of each PO's own value", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: "owner-a",
        po_amount: 1000,
        margin_amount: 150,
        po_date: "2026-04-01",
        margin_percentage: 15,
      },
      {
        created_by: "owner-a",
        po_amount: 100,
        margin_amount: 5,
        po_date: "2026-04-02",
        margin_percentage: 5,
      },
    ];

    const result = buildSalesPerformanceFromRows(rows, new Map([["owner-a", "Aimee"]]));

    // Simple mean (15 + 5) / 2 = 10 -- deliberately ignores PO size, unlike the
    // amount-weighted KPI formula used elsewhere on the dashboard.
    expect(
      result.find((entry) => entry.ownerId === "owner-a")?.marginPercentAverage,
    ).toBe(10);
  });

  it("excludes POs with no margin_percentage from the average instead of treating them as zero", () => {
    const rows: PurchaseOrderMetricRow[] = [
      {
        created_by: "owner-a",
        po_amount: 1000,
        margin_amount: 200,
        po_date: "2026-05-01",
        margin_percentage: 20,
      },
      {
        created_by: "owner-a",
        po_amount: 500,
        margin_amount: 50,
        po_date: "2026-05-02",
        margin_percentage: null,
      },
    ];

    const result = buildSalesPerformanceFromRows(rows, new Map([["owner-a", "Aimee"]]));

    expect(
      result.find((entry) => entry.ownerId === "owner-a")?.marginPercentAverage,
    ).toBe(20);
  });
});
