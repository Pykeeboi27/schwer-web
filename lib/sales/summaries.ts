import { getPeriodDateRange } from "@/lib/executive/period";
import {
  attributeBookedRevenue,
  fetchBookedPoRows,
  sumBookedRevenue,
} from "@/lib/sales/booked-revenue";
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
  const ytdRange = getPeriodDateRange("ytd");

  const [
    { count: totalClients, error: clientsError },
    bookedRows,
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
    // Closed/recognized sales share the same canonical definition as every
    // other "booked revenue" card in the app (Revenue YTD (Booked), Total PO
    // Value, Booked this year, Closed Sales) -- see lib/sales/booked-revenue.ts.
    fetchBookedPoRows(ytdRange.startDate, ytdRange.endDate),
    getQuotationCountByStatus("draft"),
    getQuotationCountByStatus("pending"),
    getQuotationCountByStatus("approved"),
    getQuotationCountByStatus("rejected"),
    getQuotationCountByStatus("closed"),
  ]);

  if (clientsError) {
    throw new Error("Failed to load sales dashboard summary.");
  }

  const companyClosedSaleTotal = sumBookedRevenue(bookedRows);
  const myClosedSaleTotal = attributeBookedRevenue(bookedRows).get(currentUserId) ?? 0;
  const recognizedSaleTotal = bookedRows.reduce(
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
