import { createClient } from "@/lib/supabase/server";

export type SectorPerformanceSlice = {
  sector: "commercial" | "industrial" | "solar";
  label: string;
  totalAmount: number;
  count: number;
};

export type ClientDistributionBar = {
  clientId: string;
  clientName: string;
  totalAmount: number;
  count: number;
};

export type SalesDashboardCharts = {
  sectorPerformance: SectorPerformanceSlice[];
  clientDistribution: ClientDistributionBar[];
};

const SECTOR_LABELS: Record<SectorPerformanceSlice["sector"], string> = {
  commercial: "Commercial",
  industrial: "Industrial",
  solar: "Solar",
};

function toSector(value: unknown): SectorPerformanceSlice["sector"] | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "commercial" || normalized === "industrial" || normalized === "solar") {
    return normalized;
  }
  return null;
}

/**
 * Aggregates approved sales quotations (booked revenue) for the two dashboard
 * charts: total value by client sector, and value/count per client.
 */
export async function getSalesDashboardCharts(): Promise<SalesDashboardCharts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("amount, client_id, clients:client_id(company_name, sector)")
    .eq("phase", "sales")
    .eq("status", "approved");

  if (error) {
    throw new Error(error.message || "Failed to load sales dashboard charts.");
  }

  const sectorTotals = new Map<
    SectorPerformanceSlice["sector"],
    { totalAmount: number; count: number }
  >();
  const clientTotals = new Map<string, ClientDistributionBar>();

  for (const row of data ?? []) {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const amount = Number(row.amount ?? 0);

    const sector = toSector(client?.sector);
    if (sector) {
      const current = sectorTotals.get(sector) ?? { totalAmount: 0, count: 0 };
      sectorTotals.set(sector, {
        totalAmount: current.totalAmount + amount,
        count: current.count + 1,
      });
    }

    const clientId = String(row.client_id ?? "");
    if (clientId) {
      const current =
        clientTotals.get(clientId) ??
        ({
          clientId,
          clientName: client?.company_name ?? "Unknown client",
          totalAmount: 0,
          count: 0,
        } satisfies ClientDistributionBar);
      clientTotals.set(clientId, {
        ...current,
        totalAmount: current.totalAmount + amount,
        count: current.count + 1,
      });
    }
  }

  const sectorPerformance: SectorPerformanceSlice[] = (
    ["commercial", "industrial", "solar"] as const
  )
    .map((sector) => {
      const totals = sectorTotals.get(sector);
      return {
        sector,
        label: SECTOR_LABELS[sector],
        totalAmount: totals?.totalAmount ?? 0,
        count: totals?.count ?? 0,
      };
    })
    .filter((slice) => slice.count > 0);

  const clientDistribution = Array.from(clientTotals.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );

  return { sectorPerformance, clientDistribution };
}
