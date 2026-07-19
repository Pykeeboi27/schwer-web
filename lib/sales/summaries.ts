import { createClient } from "@/lib/supabase/server";

export type SalesSummary = {
  totalClients: number;
  quotations: {
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
    closed: number;
  };
  myClosedSaleTotal: number;
  companyClosedSaleTotal: number;
  recognizedSaleTotal: number;
};

export const EMPTY_SALES_SUMMARY: SalesSummary = {
  totalClients: 0,
  quotations: {
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    closed: 0,
  },
  myClosedSaleTotal: 0,
  companyClosedSaleTotal: 0,
  recognizedSaleTotal: 0,
};

async function getQuotationCountByStatus(
  status: "draft" | "pending" | "approved" | "rejected" | "closed",
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

export async function getSalesSummary(currentUserId: string): Promise<SalesSummary> {
  const supabase = await createClient();

  const [
    { count: totalClients, error: clientsError },
    { data: quotationRows, error: quotationError },
    { data: poRows, error: poError },
    draft,
    pending,
    approved,
    rejected,
    closed,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    // A quotation counts as a closed sale once it's won ("approved"); it may
    // later move on to "closed" once converted to a purchase order, but it
    // stays a closed sale either way — both statuses must be included, or
    // every quotation that has completed the full cycle drops out of the total.
    supabase
      .from("quotations")
      .select("amount, sales_person_id")
      .in("status", ["approved", "closed"])
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
    getQuotationCountByStatus("closed"),
  ]);

  if (clientsError || quotationError || poError) {
    throw new Error("Failed to load sales dashboard summary.");
  }

  const { myClosedSaleTotal, companyClosedSaleTotal } = (quotationRows ?? []).reduce(
    (totals, row) => {
      const amount = Number(row.amount ?? 0);
      if (row.sales_person_id === currentUserId) {
        totals.myClosedSaleTotal += amount;
      } else {
        totals.companyClosedSaleTotal += amount;
      }
      return totals;
    },
    { myClosedSaleTotal: 0, companyClosedSaleTotal: 0 },
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
      closed,
    },
    myClosedSaleTotal,
    companyClosedSaleTotal,
    recognizedSaleTotal,
  };
}
