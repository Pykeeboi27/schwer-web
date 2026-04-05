import { describe, expect, it } from "vitest";

import {
  buildKpiSummaryFromRows,
  summarizeRevenueAndMargin,
  type PurchaseOrderMetricRow,
} from "@/lib/executive/dashboard";

describe("executive KPI metric helpers", () => {
  it("computes weighted margin and totals", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { po_amount: 100, margin_amount: 20, po_date: "2026-01-10" },
      { po_amount: 300, margin_amount: 30, po_date: "2026-01-20" },
    ];

    const summary = summarizeRevenueAndMargin(rows);

    expect(summary.bookedRevenue).toBe(400);
    expect(summary.marginAmount).toBe(50);
    expect(summary.weightedMarginPercent).toBe(12.5);
  });

  it("builds KPI summary with annual target delta", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { po_amount: 250, margin_amount: 50, po_date: "2026-02-01" },
      { po_amount: 150, margin_amount: 30, po_date: "2026-03-01" },
    ];

    const kpis = buildKpiSummaryFromRows(rows, 500);

    expect(kpis.revenueYtdBooked).toBe(400);
    expect(kpis.annualTarget).toBe(500);
    expect(kpis.revenueVsTargetDelta).toBe(-100);
    expect(kpis.marginYtdWeightedPercent).toBe(20);
  });

  it("returns null weighted margin when booked revenue is zero", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { po_amount: 0, margin_amount: 0, po_date: "2026-04-01" },
    ];

    const kpis = buildKpiSummaryFromRows(rows, null);

    expect(kpis.revenueYtdBooked).toBe(0);
    expect(kpis.marginYtdWeightedPercent).toBeNull();
    expect(kpis.revenueVsTargetDelta).toBeNull();
  });
});
