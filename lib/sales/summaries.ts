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

async function getQuotationCountByStatus(
  status: "draft" | "pending" | "approved" | "rejected",
) {
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

  const [
    { count: totalClients, error: clientsError },
    { data: quotationRows, error: quotationError },
    { data: poRows, error: poError },
    draft,
    pending,
    approved,
    rejected,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("quotations")
      .select("amount")
      .eq("status", "approved")
      .eq("phase", "sales"),
    // Recognized sales are actual collections. `purchase_orders.recognized_amount`
    // is kept current for every approved PO (converted from a quotation or
    // created manually) by addPoPayment, unlike quotations.recognized_amount,
    // which only tracks payments for POs still linked to their source quotation.
    supabase.from("purchase_orders").select("recognized_amount").eq("status", "approved"),
    getQuotationCountByStatus("draft"),
    getQuotationCountByStatus("pending"),
    getQuotationCountByStatus("approved"),
    getQuotationCountByStatus("rejected"),
  ]);

  if (clientsError || quotationError || poError) {
    throw new Error("Failed to load sales dashboard summary.");
  }

  const closedSaleTotal = (quotationRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );
  const recognizedSaleTotal = (poRows ?? []).reduce(
    (sum, row) => sum + Number(row.recognized_amount ?? 0),
    0,
  );

  return {
    totalClients: totalClients ?? 0,
    quotations: {
      draft,
      pending,
      approved,
      rejected,
    },
    closedSaleTotal,
    recognizedSaleTotal,
  };
}
