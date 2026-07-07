import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import { getSalesDashboardCharts } from "@/lib/sales/dashboard-charts";

describe("getSalesDashboardCharts", () => {
  it("aggregates sector totals and per-client distribution sorted by value", async () => {
    const rows = [
      {
        amount: 100,
        client_id: "c1",
        clients: { company_name: "Alpha", sector: "commercial" },
      },
      {
        amount: 50,
        client_id: "c1",
        clients: { company_name: "Alpha", sector: "commercial" },
      },
      {
        amount: 200,
        client_id: "c2",
        clients: { company_name: "Beta", sector: "solar" },
      },
      {
        amount: 30,
        client_id: "c3",
        clients: { company_name: "Gamma", sector: "unknown" },
      },
    ];
    mockClient = createSupabaseMock({
      tables: { quotations: { data: rows, error: null } },
    });

    const charts = await getSalesDashboardCharts();

    // Fixed order commercial→industrial→solar, empty sectors filtered out.
    expect(charts.sectorPerformance).toEqual([
      { sector: "commercial", label: "Commercial", totalAmount: 150, count: 2 },
      { sector: "solar", label: "Solar", totalAmount: 200, count: 1 },
    ]);

    // Sorted by total desc; unknown-sector client still counts in distribution.
    expect(charts.clientDistribution.map((c) => c.clientName)).toEqual([
      "Beta",
      "Alpha",
      "Gamma",
    ]);
    expect(charts.clientDistribution[0]).toEqual({
      clientId: "c2",
      clientName: "Beta",
      totalAmount: 200,
      count: 1,
    });
  });

  it("handles array-shaped client relations and missing company names", async () => {
    mockClient = createSupabaseMock({
      tables: {
        quotations: {
          data: [
            {
              amount: 75,
              client_id: "c9",
              clients: [{ company_name: null, sector: "industrial" }],
            },
          ],
          error: null,
        },
      },
    });

    const charts = await getSalesDashboardCharts();

    expect(charts.sectorPerformance).toEqual([
      { sector: "industrial", label: "Industrial", totalAmount: 75, count: 1 },
    ]);
    expect(charts.clientDistribution[0].clientName).toBe("Unknown client");
  });

  it("throws when the query fails", async () => {
    mockClient = createSupabaseMock({
      tables: { quotations: { data: null, error: { message: "boom" } } },
    });

    await expect(getSalesDashboardCharts()).rejects.toThrow("boom");
  });
});
