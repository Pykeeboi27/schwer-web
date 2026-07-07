import { describe, expect, it } from "vitest";

import {
  buildKpiSummaryFromRows,
  buildPoSummaryFromRows,
  buildRevenueBreakdownFromRows,
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

describe("buildPoSummaryFromRows", () => {
  it("counts rows and totals PO and margin amounts, coercing strings and nulls", () => {
    const rows: PurchaseOrderMetricRow[] = [
      { po_amount: 100, margin_amount: 20, po_date: "2026-01-10" },
      { po_amount: "250", margin_amount: "30", po_date: "2026-02-10" },
      { po_amount: null, margin_amount: null, po_date: null },
    ];

    expect(buildPoSummaryFromRows(rows)).toEqual({
      poCount: 3,
      totalPoValue: 350,
      totalMarginAmount: 50,
    });
  });

  it("returns zeroed totals for an empty row set", () => {
    expect(buildPoSummaryFromRows([])).toEqual({
      poCount: 0,
      totalPoValue: 0,
      totalMarginAmount: 0,
    });
  });
});

describe("buildRevenueBreakdownFromRows", () => {
  it("aggregates revenue by month, quarter, YTD month, and current-month week", () => {
    const referenceDate = new Date(2026, 4, 16); // May 2026 (month 5)

    const rowsForYear: PurchaseOrderMetricRow[] = [
      { po_amount: 100, margin_amount: 0, po_date: "2026-01-15" }, // Jan / Q1
      { po_amount: 200, margin_amount: 0, po_date: "2026-05-03" }, // May / Q2 / week 1
      { po_amount: 50, margin_amount: 0, po_date: "2026-05-20" }, // May / Q2 / week 3
    ];
    const rowsForYtd: PurchaseOrderMetricRow[] = [
      { po_amount: 100, margin_amount: 0, po_date: "2026-01-15" },
      { po_amount: 250, margin_amount: 0, po_date: "2026-05-03" },
    ];

    const breakdown = buildRevenueBreakdownFromRows(
      rowsForYear,
      rowsForYtd,
      referenceDate,
    );

    expect(breakdown.monthlyRevenue).toHaveLength(12);
    expect(breakdown.monthlyRevenue.find((m) => m.month === 1)?.bookedRevenue).toBe(100);
    expect(breakdown.monthlyRevenue.find((m) => m.month === 5)?.bookedRevenue).toBe(250);

    expect(breakdown.quarterlyRevenue.find((q) => q.quarter === 1)?.bookedRevenue).toBe(
      100,
    );
    expect(breakdown.quarterlyRevenue.find((q) => q.quarter === 2)?.bookedRevenue).toBe(
      250,
    );

    expect(breakdown.ytdRevenueByMonth.find((m) => m.month === 5)?.bookedRevenue).toBe(
      250,
    );

    expect(breakdown.weeklyRevenue.find((w) => w.week === 1)?.bookedRevenue).toBe(200);
    expect(breakdown.weeklyRevenue.find((w) => w.week === 3)?.bookedRevenue).toBe(50);
    expect(breakdown.weeklyRevenue.find((w) => w.week === 2)?.bookedRevenue).toBe(0);
  });

  it("ignores rows with malformed or missing dates", () => {
    const referenceDate = new Date(2026, 4, 16);

    const breakdown = buildRevenueBreakdownFromRows(
      [
        { po_amount: 999, margin_amount: 0, po_date: null },
        { po_amount: 999, margin_amount: 0, po_date: "bad" },
      ],
      [],
      referenceDate,
    );

    const totalMonthly = breakdown.monthlyRevenue.reduce(
      (sum, point) => sum + point.bookedRevenue,
      0,
    );
    expect(totalMonthly).toBe(0);
  });
});
