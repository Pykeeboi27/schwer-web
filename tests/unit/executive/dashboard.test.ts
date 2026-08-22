import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/executive/targets", () => ({
  getQuarterlyTargets: vi.fn(async () => ({ q1: 100, q2: 200, q3: null, q4: null })),
}));

vi.mock("@/lib/sales/dashboard-charts", () => ({
  getSalesDashboardCharts: vi.fn(async () => ({
    sectorPerformance: [],
    clientDistribution: [],
  })),
}));

import {
  executiveDashboardQueries,
  getExecutiveDashboardData,
  getExecutiveKpiSummary,
  getExecutivePoSummary,
  getExecutiveRevenueBreakdown,
  getExecutiveSalesPerformance,
  type PurchaseOrderMetricRow,
} from "@/lib/executive/dashboard";
import type { CurrentProfile } from "@/lib/profile/get-current-profile";

const referenceDate = new Date(2026, 4, 16); // May 2026

const rows: PurchaseOrderMetricRow[] = [
  { po_amount: 200, margin_amount: 40, po_date: "2026-05-03", created_by: "o1" },
  { po_amount: 100, margin_amount: 10, po_date: "2026-01-15", created_by: "o2" },
];

const viewer: CurrentProfile = {
  id: "v1",
  email: "exec@example.com",
  department: "executive",
  isActive: true,
  role: "executive",
  isExecutiveViewer: true,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(executiveDashboardQueries, "fetchPurchaseOrderRows").mockResolvedValue(rows);
  vi.spyOn(executiveDashboardQueries, "fetchAnnualTarget").mockResolvedValue(1000);
  vi.spyOn(executiveDashboardQueries, "fetchSalesRoster").mockResolvedValue([
    { ownerId: "o1", ownerName: "Owner One" },
  ]);
  vi.spyOn(executiveDashboardQueries, "fetchProfileUsernames").mockResolvedValue(
    new Map(),
  );
});

describe("getExecutiveKpiSummary", () => {
  it("combines booked revenue, annual target, and quarterly targets", async () => {
    const kpi = await getExecutiveKpiSummary({ referenceDate });

    // bookedRevenue is the gross PO total: 200 + 100 = 300, matching Total PO Value.
    expect(kpi.revenueYtdBooked).toBe(300);
    expect(kpi.annualTarget).toBe(1000);
    expect(kpi.quarterlyTargets).toEqual({ q1: 100, q2: 200, q3: null, q4: null });
    expect(kpi.revenueVsTargetDelta).toBe(-700);
    expect(kpi.marginYtdWeightedPercent).toBeCloseTo((50 / 300) * 100, 5);
  });
});

describe("getExecutivePoSummary", () => {
  it("counts POs and sums value, margin, and collected amounts", async () => {
    await expect(getExecutivePoSummary("ytd", { referenceDate })).resolves.toEqual({
      poCount: 2,
      totalPoValue: 300,
      totalMarginAmount: 50,
      totalCollectedAmount: 0,
    });
  });

  it("queries the selected month rather than the reference date's month", async () => {
    await getExecutivePoSummary("monthly", { referenceDate, breakdownMonth: 2 });

    expect(executiveDashboardQueries.fetchPurchaseOrderRows).toHaveBeenCalledWith({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("queries the selected quarter rather than the reference date's quarter", async () => {
    await getExecutivePoSummary("quarterly", { referenceDate, breakdownQuarter: 1 });

    expect(executiveDashboardQueries.fetchPurchaseOrderRows).toHaveBeenCalledWith({
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });
  });
});

describe("getExecutiveRevenueBreakdown", () => {
  it("buckets revenue by month using year and YTD row sets", async () => {
    const breakdown = await getExecutiveRevenueBreakdown("ytd", { referenceDate });

    expect(breakdown.monthlyRevenue).toHaveLength(12);
    expect(breakdown.monthlyRevenue.find((m) => m.month === 5)?.bookedRevenue).toBe(200);
    expect(breakdown.monthlyRevenue.find((m) => m.month === 1)?.bookedRevenue).toBe(100);
    expect(breakdown.ytdRevenueByMonth.find((m) => m.month === 5)?.bookedRevenue).toBe(
      200,
    );
  });
});

describe("getExecutiveSalesPerformance", () => {
  it("ranks owners and resolves names with a fallback", async () => {
    const performance = await getExecutiveSalesPerformance("ytd", { referenceDate });

    expect(performance[0]).toMatchObject({
      ownerId: "o1",
      ownerName: "Owner One",
      bookedRevenue: 200,
    });
    expect(performance[1].ownerId).toBe("o2");
    expect(performance[1].ownerName).toBe("Unknown");
  });

  it("scopes the owner ranking to the selected month", async () => {
    await getExecutiveSalesPerformance("monthly", { referenceDate, breakdownMonth: 4 });

    expect(executiveDashboardQueries.fetchPurchaseOrderRows).toHaveBeenCalledWith({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });
  });
});

describe("getExecutiveDashboardData", () => {
  it("assembles every section for an authorized (or unspecified) viewer", async () => {
    const data = await getExecutiveDashboardData("ytd", { viewer, referenceDate });

    expect(data.periodFilter).toBe("ytd");
    expect(data.kpis.revenueYtdBooked).toBe(data.poSummary.totalPoValue);
    expect(data.kpis.revenueYtdBooked).toBe(300);
    expect(data.poSummary.poCount).toBe(2);
    expect(data.salesPerformance[0].ownerId).toBe("o1");
    expect(data.charts).toEqual({ sectorPerformance: [], clientDistribution: [] });
  });

  it("rejects viewers without executive dashboard access", async () => {
    const nonViewer: CurrentProfile = {
      id: "s1",
      email: "sales@example.com",
      department: "sales",
      isActive: true,
      role: "sales_staff",
      isExecutiveViewer: false,
    };

    await expect(
      getExecutiveDashboardData("ytd", { viewer: nonViewer, referenceDate }),
    ).rejects.toThrow(/Unauthorized executive dashboard access/);
  });
});
