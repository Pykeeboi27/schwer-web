import { createClient } from "@/lib/supabase/server";
import { validatePoTotalAmount } from "@/lib/utils/form-validation";

export type SalesPurchaseOrder = {
  id: string;
  quotationId: string;
  poNumber: string;
  clientId: string;
  clientName: string;
  subject: string;
  poAmount: number;
  cost: number | null;
  recognizedAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid" | "overdue";
  paymentTerms: string | null;
  leadTimeDays: number | null;
  salesMarginPercent: number | null;
  approvedAt: string | null;
};

export type SalesPoPayment = {
  id: string;
  poId: string;
  amountCollected: number;
  paymentDate: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
};

function derivePaymentStatus(
  poAmount: number,
  recognizedAmount: number,
): "unpaid" | "partial" | "paid" {
  if (recognizedAmount <= 0) {
    return "unpaid";
  }

  if (recognizedAmount < poAmount) {
    return "partial";
  }

  return "paid";
}

export async function fetchPurchaseOrders(_departmentId?: string): Promise<SalesPurchaseOrder[]> {
  void _departmentId;
  return listPurchaseOrders();
}

export function parsePoAmount(raw: unknown): number {
  const normalized = String(raw ?? "").trim();
  const validationError = validatePoTotalAmount(normalized);

  if (validationError) {
    throw new Error(validationError);
  }

  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    throw new Error("PO total amount must be a valid number.");
  }

  return value;
}

export function assertCollectionDoesNotExceedPo(poAmount: number, collectedAmount: number): void {
  if (collectedAmount > poAmount) {
    throw new Error("Collected amount cannot exceed the PO amount.");
  }
}

export async function listPurchaseOrders(): Promise<SalesPurchaseOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, client_id, subject, amount, cost, recognized_amount, payment_status, payment_terms, lead_time_days, sales_margin_percent, approved_at, clients:client_id(company_name)",
    )
    .eq("status", "approved")
    .eq("phase", "sales")
    .order("approved_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message || "Failed to load purchase orders.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;

    return {
      id: row.id,
      quotationId: row.id,
      poNumber: row.quotation_number,
      clientId: row.client_id,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      poAmount: Number(row.amount),
      cost: row.cost === null || row.cost === undefined ? null : Number(row.cost),
      recognizedAmount: Number(row.recognized_amount ?? 0),
      paymentStatus: row.payment_status ?? "unpaid",
      paymentTerms: row.payment_terms ?? null,
      leadTimeDays:
        row.lead_time_days === null || row.lead_time_days === undefined
          ? null
          : Number(row.lead_time_days),
      salesMarginPercent:
        row.sales_margin_percent === null || row.sales_margin_percent === undefined
          ? null
          : Number(row.sales_margin_percent),
      approvedAt: row.approved_at ?? null,
    };
  });
}

export async function listPoPayments(poId?: string): Promise<SalesPoPayment[]> {
  const supabase = await createClient();
  let query = supabase
    .from("po_payments")
    .select("id, po_id, amount_collected, payment_date, payment_method, reference_number")
    .order("created_at", { ascending: false });

  if (poId) {
    query = query.eq("po_id", poId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Failed to load PO payments.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    poId: row.po_id,
    amountCollected: Number(row.amount_collected),
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
  }));
}

export async function addPoPayment(input: {
  poId: string;
  amountCollected: number;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: quotationRow, error: quotationError } = await supabase
    .from("quotations")
    .select("amount, status, recognized_amount")
    .eq("id", input.poId)
    .single();

  if (quotationError || !quotationRow) {
    throw new Error("Approved quotation was not found.");
  }

  if (quotationRow.status !== "approved") {
    throw new Error("Payments can only be recorded against approved quotations.");
  }

  const poAmount = Number(quotationRow.amount);
  const currentRecognized = Number(quotationRow.recognized_amount ?? 0);

  assertCollectionDoesNotExceedPo(poAmount, currentRecognized + input.amountCollected);

  const { error } = await supabase.from("po_payments").insert({
    po_id: input.poId,
    amount_collected: input.amountCollected,
    payment_date: input.paymentDate || new Date().toISOString().slice(0, 10),
    payment_method: input.paymentMethod ?? null,
    reference_number: input.referenceNumber ?? null,
    notes: input.notes ?? null,
    recorded_by: user?.id ?? null,
  });

  if (error) {
    throw new Error(error.message || "Failed to add PO payment.");
  }

  // Recompute and persist quotation collection totals in-app so the UI remains
  // correct even if the DB trigger is missing or out of date.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("po_payments")
    .select("amount_collected")
    .eq("po_id", input.poId);

  if (paymentsError) {
    throw new Error(paymentsError.message || "Failed to refresh quotation totals.");
  }

  const refreshedRecognizedAmount = (paymentRows ?? []).reduce((sum, row) => {
    return sum + Number(row.amount_collected ?? 0);
  }, 0);

  assertCollectionDoesNotExceedPo(poAmount, refreshedRecognizedAmount);

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      recognized_amount: refreshedRecognizedAmount,
      payment_status: derivePaymentStatus(poAmount, refreshedRecognizedAmount),
    })
    .eq("id", input.poId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update quotation totals.");
  }
}
