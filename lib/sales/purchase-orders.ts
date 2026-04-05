import { createClient } from "@/lib/supabase/server";
import { validatePoTotalAmount } from "@/lib/utils/form-validation";

export type SalesPurchaseOrder = {
  id: string;
  poNumber: string;
  clientId: string;
  clientName: string;
  subject: string;
  poAmount: number;
  recognizedAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid" | "overdue";
  paymentTermsDays: number;
  poDate: string;
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
  // Department filtering is enforced through RLS for the current session.
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
    .from("purchase_orders")
    .select(
      "id, po_number, client_id, subject, po_amount, recognized_amount, payment_status, payment_terms_days, po_date, clients:client_id(company_name)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load purchase orders.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;

    return {
      id: row.id,
      poNumber: row.po_number,
      clientId: row.client_id,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      poAmount: Number(row.po_amount),
      recognizedAmount: Number(row.recognized_amount),
      paymentStatus: row.payment_status,
      paymentTermsDays: row.payment_terms_days,
      poDate: row.po_date,
    };
  });
}

export async function generateNextPoNumber(
  departmentCode = "SALES",
): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const normalizedDepartmentCode = String(departmentCode ?? "")
    .trim()
    .toUpperCase();
  const prefix = `PO-${normalizedDepartmentCode}-${year}-`;

  const { data, error } = await supabase
    .from("purchase_orders")
    .select("po_number")
    .like("po_number", `${prefix}%`)
    .order("po_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error("Failed to generate purchase order number.");
  }

  const latestPoNumber = data?.[0]?.po_number ?? null;
  const currentSequence = latestPoNumber
    ? Number((latestPoNumber.match(/(\d{4})$/) ?? ["", "0"])[1])
    : 0;

  const nextSequence = currentSequence + 1;
  const sequence = String(nextSequence).padStart(4, "0");

  return `${prefix}${sequence}`;
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

export async function createPurchaseOrder(input: {
  clientId: string;
  subject: string;
  poAmount: number;
  poNumber?: string;
  cost?: number | null;
  paymentTermsDays: number;
  notes?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("sector")
    .eq("id", input.clientId)
    .single();

  if (clientError || !clientRow) {
    throw new Error("Selected client was not found.");
  }

  const poNumber = input.poNumber ?? `PO-${Date.now()}`;
  const { error } = await supabase.from("purchase_orders").insert({
    po_number: poNumber,
    client_id: input.clientId,
    sector: clientRow.sector,
    subject: input.subject,
    po_amount: input.poAmount,
    cost: input.cost ?? null,
    payment_terms_days: input.paymentTermsDays,
    notes: input.notes ?? null,
    created_by: user.id,
  });

  if (error) {
    throw new Error(error.message || "Failed to create purchase order.");
  }
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

  const { data: poRow, error: poError } = await supabase
    .from("purchase_orders")
    .select("po_amount, recognized_amount")
    .eq("id", input.poId)
    .single();

  if (poError || !poRow) {
    throw new Error("Purchase order was not found.");
  }

  assertCollectionDoesNotExceedPo(
    Number(poRow.po_amount),
    Number(poRow.recognized_amount) + input.amountCollected,
  );

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

  // Recompute and persist PO collection totals in-app so UI remains correct
  // even when DB triggers/functions are missing or outdated.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("po_payments")
    .select("amount_collected")
    .eq("po_id", input.poId);

  if (paymentsError) {
    throw new Error(paymentsError.message || "Failed to refresh purchase order totals.");
  }

  const refreshedRecognizedAmount = (paymentRows ?? []).reduce((sum, row) => {
    return sum + Number(row.amount_collected ?? 0);
  }, 0);

  const poAmount = Number(poRow.po_amount);

  assertCollectionDoesNotExceedPo(poAmount, refreshedRecognizedAmount);

  const { error: updatePoError } = await supabase
    .from("purchase_orders")
    .update({
      recognized_amount: refreshedRecognizedAmount,
      payment_status: derivePaymentStatus(poAmount, refreshedRecognizedAmount),
    })
    .eq("id", input.poId);

  if (updatePoError) {
    throw new Error(updatePoError.message || "Failed to update purchase order totals.");
  }
}
