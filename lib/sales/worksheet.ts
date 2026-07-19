import { parseClientContactNotes } from "@/lib/sales/clients";
import { createClient } from "@/lib/supabase/server";

/**
 * Flat, print-ready view of a purchase order for the Sales Worksheet
 * (paper form) print page. Assembled from purchase_orders plus its related
 * client, source quotation, and creating profile — none of which
 * purchase_orders carries directly.
 *
 * Contact person/number come from the client's own contact fields (stored in
 * `clients.notes`, see `parseClientContactNotes`) rather than the
 * `client_contacts` directory table — that table holds additional contacts a
 * client dialog can manage, but the worksheet always uses the client's
 * primary contact info directly.
 */
export type PurchaseOrderWorksheetItem = {
  description: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
};

export type PurchaseOrderWorksheetData = {
  id: string;
  poNumber: string;
  clientPoNumber: string | null;
  quotationNumber: string | null;
  subject: string;
  poAmount: number;
  /**
   * Pricing percentages printed together in the worksheet REMARKS box.
   * `marginPercent` prefers the sales-entered `margin_percentage`, falling
   * back to the generated `margin_percent` (derived from po_amount vs. cost).
   * Each is null when not set on the PO.
   */
  marginPercent: number | null;
  bankPercent: number | null;
  sopPercent: number | null;
  items: PurchaseOrderWorksheetItem[];
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

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function getPurchaseOrderWorksheetData(
  poId: string,
): Promise<PurchaseOrderWorksheetData | null> {
  const supabase = await createClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      `id, po_number, client_po_number, quotation_reference, subject, po_amount,
       cost, margin_percentage, margin_percent, bank_percentage, sop_percentage,
       payment_terms, payment_terms_custom, lead_time_days, po_date, expected_completion,
       notes, sector, created_at, created_by,
       clients:client_id ( company_name, address, city, province, tin, notes ),
       quotations:quotation_id ( quotation_number ),
       creator:created_by ( full_name ),
       purchase_order_items ( description, quantity, unit_cost, line_total, sort_order )`,
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
  const clientContact = parseClientContactNotes(client?.notes ?? null);

  const paymentTerms =
    po.payment_terms === "Other" ? po.payment_terms_custom : po.payment_terms;

  const items = (Array.isArray(po.purchase_order_items) ? po.purchase_order_items : [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitCost: item.unit_cost === null ? null : Number(item.unit_cost),
      lineTotal: Number(item.line_total),
    }));

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
    marginPercent: toNullableNumber(po.margin_percentage ?? po.margin_percent),
    bankPercent: toNullableNumber(po.bank_percentage),
    sopPercent: toNullableNumber(po.sop_percentage),
    items,
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
    contactPersonName: clientContact.contactPerson,
    contactNumber: clientContact.phone ?? clientContact.email ?? null,
  };
}
