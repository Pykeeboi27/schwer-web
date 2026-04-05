import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  executiveDashboardQueries,
  getExecutiveDashboardData,
  type PurchaseOrderMetricRow,
} from "@/lib/executive/dashboard";
import type { CurrentProfile } from "@/lib/profile/get-current-profile";

const referenceDate = new Date("2026-06-15T12:00:00.000Z");

const rows: PurchaseOrderMetricRow[] = [
  { created_by: "owner-1", po_amount: 100, margin_amount: 20, po_date: "2026-01-10" },
  { created_by: "owner-1", po_amount: 250, margin_amount: 70, po_date: "2026-05-05" },
  { created_by: "owner-2", po_amount: 500, margin_amount: 120, po_date: "2026-06-01" },
  { created_by: "owner-3", po_amount: 800, margin_amount: 200, po_date: "2026-10-01" },
];

const viewerProfile: CurrentProfile = {
  id: "viewer-2",
  email: "viewer2@example.com",
  department: "executive",
  isActive: true,
  role: "executive",
  isExecutiveViewer: true,
};

function filterRowsByRange(startDate: string, endDate: string) {
  return rows.filter((row) => row.po_date && row.po_date >= startDate && row.po_date <= endDate);
}

describe("executive sales performance integration", () => {
  beforeEach(() => {
    vi.spyOn(executiveDashboardQueries, "fetchPurchaseOrderRows").mockImplementation(
      async ({ startDate, endDate }) => filterRowsByRange(startDate, endDate),
    );

    vi.spyOn(executiveDashboardQueries, "fetchAnnualTarget").mockResolvedValue(1000);

    vi.spyOn(executiveDashboardQueries, "fetchProfileNames").mockResolvedValue(
      new Map<string, string>([
        ["owner-1", "Alex"],
        ["owner-2", "Bianca"],
        ["owner-3", "Cory"],
      ]),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ranked sales performance rows for monthly filter", async () => {
    const dashboard = await getExecutiveDashboardData("monthly", {
      viewer: viewerProfile,
      referenceDate,
    });

    expect(dashboard.salesPerformance).toHaveLength(1);
    expect(dashboard.salesPerformance[0].ownerName).toBe("Bianca");
    expect(dashboard.salesPerformance[0].bookedRevenue).toBe(500);
  });

  it("updates ranking for quarterly and ytd filters", async () => {
    const quarterly = await getExecutiveDashboardData("quarterly", {
      viewer: viewerProfile,
      referenceDate,
    });

    expect(quarterly.salesPerformance.map((entry) => entry.ownerName)).toEqual([
      "Bianca",
      "Alex",
    ]);

    const ytd = await getExecutiveDashboardData("ytd", {
      viewer: viewerProfile,
      referenceDate,
    });

    expect(ytd.salesPerformance.map((entry) => entry.ownerName)).toEqual([
      "Bianca",
      "Alex",
    ]);
  });
});
