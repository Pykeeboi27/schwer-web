import { describe, expect, it } from "vitest";

import {
  buildSalesPerformanceFromRows,
  type PurchaseOrderMetricRow,
} from "@/lib/executive/dashboard";

describe("executive sales performance helpers", () => {
  it("ranks owners by booked revenue and applies tie-break on owner name", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { created_by: "owner-a", po_amount: 250, margin_amount: 50, po_date: "2026-01-10" },
      { created_by: "owner-b", po_amount: 400, margin_amount: 120, po_date: "2026-01-11" },
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
  });

  it("uses fallback labels when owner name cannot be resolved", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { created_by: null, po_amount: 100, margin_amount: 10, po_date: "2026-02-01" },
      { created_by: "abc12345-ffff", po_amount: 200, margin_amount: 20, po_date: "2026-02-02" },
    ];

    const result = buildSalesPerformanceFromRows(rows, new Map());

    expect(result.find((entry) => entry.ownerId === "unassigned")?.ownerName).toBe("Unassigned");
    expect(result.find((entry) => entry.ownerId === "abc12345-ffff")?.ownerName).toContain("Owner");
  });
});
