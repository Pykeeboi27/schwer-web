import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  executiveDashboardQueries,
  getExecutiveDashboardData,
  type PurchaseOrderMetricRow,
} from "@/lib/executive/dashboard";
import type { CurrentProfile } from "@/lib/profile/get-current-profile";

const referenceDate = new Date("2026-06-15T12:00:00.000Z");

const mockRows: PurchaseOrderMetricRow[] = [
  { po_amount: 100, margin_amount: 20, po_date: "2026-01-10" },
  { po_amount: 200, margin_amount: 50, po_date: "2026-02-20" },
  { po_amount: 300, margin_amount: 60, po_date: "2026-05-01" },
  { po_amount: 400, margin_amount: 120, po_date: "2026-10-01" },
];

const viewerProfile: CurrentProfile = {
  id: "viewer-1",
  email: "viewer@example.com",
  department: "executive",
  isActive: true,
  role: "executive",
  isExecutiveViewer: true,
};

const nonViewerProfile: CurrentProfile = {
  ...viewerProfile,
  role: "sales_staff",
  isExecutiveViewer: false,
};

function filterRowsByRange(rows: PurchaseOrderMetricRow[], startDate: string, endDate: string) {
  return rows.filter((row) => {
    if (!row.po_date) {
      return false;
    }

    return row.po_date >= startDate && row.po_date <= endDate;
  });
}

describe("executive dashboard KPI integration", () => {
  beforeEach(() => {
    vi.spyOn(executiveDashboardQueries, "fetchPurchaseOrderRows").mockImplementation(
      async ({ startDate, endDate }) => filterRowsByRange(mockRows, startDate, endDate),
    );
    vi.spyOn(executiveDashboardQueries, "fetchAnnualTarget").mockResolvedValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns expected KPI and breakdown values for monthly filter", async () => {
    const dashboard = await getExecutiveDashboardData("monthly", {
      viewer: viewerProfile,
      referenceDate,
    });

    expect(dashboard.kpis.revenueYtdBooked).toBe(600);
    expect(dashboard.kpis.annualTarget).toBe(1000);
    expect(dashboard.kpis.revenueVsTargetDelta).toBe(-400);
    expect(Number(dashboard.kpis.marginYtdWeightedPercent?.toFixed(2))).toBe(21.67);

    expect(dashboard.revenueBreakdown.monthlyRevenue.find((entry) => entry.month === 1)?.bookedRevenue).toBe(100);
    expect(dashboard.revenueBreakdown.monthlyRevenue.find((entry) => entry.month === 10)?.bookedRevenue).toBe(400);
    expect(dashboard.poSummary.poCount).toBe(0);
  });

  it("returns period-specific PO summary for quarterly and ytd filters", async () => {
    const quarterly = await getExecutiveDashboardData("quarterly", {
      viewer: viewerProfile,
      referenceDate,
    });

    expect(quarterly.poSummary.poCount).toBe(1);
    expect(quarterly.poSummary.totalPoValue).toBe(300);

    const ytd = await getExecutiveDashboardData("ytd", {
      viewer: viewerProfile,
      referenceDate,
    });

    expect(ytd.poSummary.poCount).toBe(3);
    expect(ytd.poSummary.totalPoValue).toBe(600);
    expect(ytd.revenueBreakdown.ytdRevenueByMonth.find((entry) => entry.month === 10)?.bookedRevenue).toBe(0);
  });

  it("rejects non-viewers from dashboard aggregate access", async () => {
    await expect(
      getExecutiveDashboardData("ytd", {
        viewer: nonViewerProfile,
        referenceDate,
      }),
    ).rejects.toThrow(/Unauthorized executive dashboard access/);
  });
});
