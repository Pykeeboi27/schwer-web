import { createClient } from "@/lib/supabase/server";

/**
 * Flat, print-ready view of a purchase order for the Sales Worksheet
 * (paper form) print page. Assembled from purchase_orders plus its related
 * client, primary client contact, source quotation, and creating profile —
 * none of which purchase_orders carries directly.
 *
 * Note: `clients` has no contact_person/phone/email columns in production,
 * so contact person/number come solely from the primary client_contacts row.
 */
export type PurchaseOrderWorksheetData = {
  id: string;
  poNumber: string;
  clientPoNumber: string | null;
  quotationNumber: string | null;
  subject: string;
  poAmount: number;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  poDate: string | null;
  expectedCompletion: string | null;
  notes: string | null;
  sector: string | null;
  createdAt: string;
  salesPersonName: string;
  clientName: string;
  clientAddress: string;
  clientTin: string | null;
  contactPersonName: string | null;
  contactNumber: string | null;
};

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part && part.trim() !== "").join(", ");
}

export async function getPurchaseOrderWorksheetData(
  poId: string,
): Promise<PurchaseOrderWorksheetData | null> {
  const supabase = await createClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      `id, po_number, client_po_number, quotation_reference, subject, po_amount,
       payment_terms, payment_terms_custom, lead_time_days, po_date, expected_completion,
       notes, sector, created_at, client_id, created_by,
       clients:client_id ( company_name, address, city, province, tin ),
       quotations:quotation_id ( quotation_number ),
       creator:created_by ( full_name )`,
    )
    .eq("id", poId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load purchase order worksheet data.");
  }

  if (!po) {
    return null;
  }

  const client = Array.isArray(po.clients) ? po.clients[0] : po.clients;
  const quotation = Array.isArray(po.quotations) ? po.quotations[0] : po.quotations;
  const creator = Array.isArray(po.creator) ? po.creator[0] : po.creator;

  const { data: primaryContact } = await supabase
    .from("client_contacts")
    .select("full_name, phone, mobile")
    .eq("client_id", po.client_id)
    .eq("is_primary", true)
    .maybeSingle();

  const paymentTerms =
    po.payment_terms === "Other" ? po.payment_terms_custom : po.payment_terms;

  return {
    id: po.id,
    poNumber: po.po_number,
    clientPoNumber: po.client_po_number ?? null,
    quotationNumber:
      ((po as Record<string, unknown>).quotation_reference as string | null) ??
      quotation?.quotation_number ??
      null,
    subject: po.subject,
    poAmount: Number(po.po_amount),
    paymentTerms: paymentTerms ?? null,
    leadTimeDays: po.lead_time_days ?? null,
    poDate: po.po_date ?? null,
    expectedCompletion: po.expected_completion ?? null,
    notes: po.notes ?? null,
    sector: po.sector ?? null,
    createdAt: po.created_at,
    salesPersonName: creator?.full_name ?? "",
    clientName: client?.company_name ?? "",
    clientAddress: joinAddress([client?.address, client?.city, client?.province]),
    clientTin: client?.tin ?? null,
    contactPersonName: primaryContact?.full_name ?? null,
    contactNumber: primaryContact?.mobile ?? primaryContact?.phone ?? null,
  };
}
