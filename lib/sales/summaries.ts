import { createClient } from "@/lib/supabase/server";

export type SalesSummary = {
  totalClients: number;
  quotations: {
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  closedSaleTotal: number;
  recognizedSaleTotal: number;
};

export const EMPTY_SALES_SUMMARY: SalesSummary = {
  totalClients: 0,
  quotations: {
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  },
  closedSaleTotal: 0,
  recognizedSaleTotal: 0,
};

async function getQuotationCountByStatus(status: "draft" | "pending" | "approved" | "rejected") {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("quotations")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) {
    throw new Error("Failed to load quotation summary.");
  }

  return count ?? 0;
}

export async function getSalesSummary(): Promise<SalesSummary> {
  const supabase = await createClient();

  const [{ count: totalClients, error: clientsError }, { data: poRows, error: poError }, draft, pending, approved, rejected] =
    await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("quotations")
        .select("amount, recognized_amount")
        .eq("status", "approved")
        .eq("phase", "sales"),
      getQuotationCountByStatus("draft"),
      getQuotationCountByStatus("pending"),
      getQuotationCountByStatus("approved"),
      getQuotationCountByStatus("rejected"),
    ]);

  if (clientsError || poError) {
    throw new Error("Failed to load sales dashboard summary.");
  }

  const totals = (poRows ?? []).reduce(
    (acc, row) => {
      const poAmount = Number(row.amount ?? 0);
      const recognizedAmount = Number(row.recognized_amount ?? 0);
      return {
        closed: acc.closed + poAmount,
        recognized: acc.recognized + recognizedAmount,
      };
    },
    { closed: 0, recognized: 0 },
  );

  return {
    totalClients: totalClients ?? 0,
    quotations: {
      draft,
      pending,
      approved,
      rejected,
    },
    closedSaleTotal: totals.closed,
    recognizedSaleTotal: totals.recognized,
  };
}
