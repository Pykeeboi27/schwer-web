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
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    normalized === "commercial" ||
    normalized === "industrial" ||
    normalized === "solar"
  ) {
    return normalized;
  }
  return null;
}

/**
 * Aggregates booked-revenue sales quotations (status `approved` or `closed` —
 * `closed` is an approved quotation already converted to a purchase order),
 * plus standalone manually-encoded purchase orders (which have no source
 * quotation to aggregate through), for the two dashboard charts: total value
 * by client sector, and value/count per client.
 */
export async function getSalesDashboardCharts(): Promise<SalesDashboardCharts> {
  const supabase = await createClient();
  const [
    { data: quotationRows, error: quotationError },
    { data: encodedPoRows, error: encodedPoError },
  ] = await Promise.all([
    supabase
      .from("quotations")
      .select("amount, client_id, clients:client_id(company_name, sector)")
      .eq("phase", "sales")
      .in("status", ["approved", "closed"]),
    supabase
      .from("purchase_orders")
      .select("po_amount, client_id, sector, clients:client_id(company_name)")
      .eq("status", "approved")
      .eq("is_manually_encoded", true),
  ]);

  if (quotationError) {
    throw new Error(quotationError.message || "Failed to load sales dashboard charts.");
  }
  if (encodedPoError) {
    throw new Error(encodedPoError.message || "Failed to load sales dashboard charts.");
  }

  const sectorTotals = new Map<
    SectorPerformanceSlice["sector"],
    { totalAmount: number; count: number }
  >();
  const clientTotals = new Map<string, ClientDistributionBar>();

  function accumulate(
    amount: number,
    sectorValue: unknown,
    clientId: unknown,
    clientName: unknown,
  ) {
    const sector = toSector(sectorValue);
    if (sector) {
      const current = sectorTotals.get(sector) ?? { totalAmount: 0, count: 0 };
      sectorTotals.set(sector, {
        totalAmount: current.totalAmount + amount,
        count: current.count + 1,
      });
    }

    const id = String(clientId ?? "");
    if (id) {
      const current =
        clientTotals.get(id) ??
        ({
          clientId: id,
          clientName: (clientName as string | undefined) ?? "Unknown client",
          totalAmount: 0,
          count: 0,
        } satisfies ClientDistributionBar);
      clientTotals.set(id, {
        ...current,
        totalAmount: current.totalAmount + amount,
        count: current.count + 1,
      });
    }
  }

  for (const row of quotationRows ?? []) {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    accumulate(
      Number(row.amount ?? 0),
      client?.sector,
      row.client_id,
      client?.company_name,
    );
  }

  for (const row of encodedPoRows ?? []) {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    accumulate(
      Number(row.po_amount ?? 0),
      row.sector,
      row.client_id,
      client?.company_name,
    );
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
