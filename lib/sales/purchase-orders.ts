import {
  aggregateQuotationStatus,
  findApproversForRole,
  requiredApproverRolesForAmount,
  type RequiredApproverRole,
} from "@/lib/sales/quotations";
import { computeSalesPricing } from "@/lib/sales/pricing";
import { createClient } from "@/lib/supabase/server";
import { validatePoTotalAmount } from "@/lib/utils/form-validation";

export type PurchaseOrderStatus =
  "draft" | "pending" | "approved" | "rejected" | "cancelled";

export type SalesPurchaseOrderItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
};

export type SalesPurchaseOrder = {
  id: string;
  quotationId: string | null;
  poNumber: string;
  clientPoNumber: string | null;
  quotationReference: string | null;
  clientId: string;
  clientName: string;
  subject: string;
  poAmount: number;
  cost: number | null;
  items: SalesPurchaseOrderItem[];
  marginPercentage: number | null;
  marginAmount: number | null;
  bankPercentage: number | null;
  bankAmount: number | null;
  sopPercentage: number | null;
  sopAmount: number | null;
  sellingAmount: number | null;
  recognizedAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid" | "overdue";
  paymentTerms: string | null;
  paymentTermsCustom: string | null;
  leadTimeDays: number | null;
  salesMarginPercent: number | null;
  status: PurchaseOrderStatus;
  pendingApprovalRoles: RequiredApproverRole[];
  rejectionReason: string | null;
  rejectedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  itemCount: number;
};

export type SalesPoPayment = {
  id: string;
  poId: string;
  purchaseOrderId: string | null;
  amountCollected: number;
  paymentDate: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
};

export type PendingPoApprovalItem = {
  approvalId: string;
  poId: string;
  poNumber: string;
  subject: string;
  amount: number;
  approverRole: string;
  status: string;
  clientName?: string;
  cost?: number | null;
  marginAmount?: number | null;
  sector?: string | null;
  poDate?: string | null;
  createdByName?: string;
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

function toRequiredApproverRole(role: unknown): RequiredApproverRole | null {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();
  if (
    normalized === "sales_manager" ||
    normalized === "owner" ||
    normalized === "executive"
  ) {
    return normalized;
  }
  return null;
}

export async function fetchPurchaseOrders(
  _departmentId?: string,
): Promise<SalesPurchaseOrder[]> {
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

export function assertCollectionDoesNotExceedPo(
  poAmount: number,
  collectedAmount: number,
): void {
  if (collectedAmount > poAmount) {
    throw new Error("Collected amount cannot exceed the PO amount.");
  }
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Full name if set, else the email username (before the "@"), else null. */
function resolveDisplayName(
  profile: { full_name?: string | null; email?: string | null } | null | undefined,
): string | null {
  const fullName = profile?.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const email = profile?.email?.trim();
  if (email) {
    return email.split("@")[0];
  }

  return null;
}

export async function listPurchaseOrders(): Promise<SalesPurchaseOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, quotation_id, po_number, client_po_number, quotation_reference, client_id, subject, po_amount, cost, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount, recognized_amount, payment_status, payment_terms, payment_terms_custom, lead_time_days, status, approved_at, created_at, created_by, clients:client_id(company_name), po_approvals(approver_role, status, rejection_reason, updated_at, approver:approver_id(full_name, email)), creator:created_by(full_name, email), purchase_order_items(id, description, quantity, unit_cost, line_total, sort_order)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load purchase orders.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    const approvals = Array.isArray(row.po_approvals) ? row.po_approvals : [];
    const pendingApprovalRoles = Array.from(
      new Set(
        approvals
          .filter((a) => a.status === "pending")
          .map((a) => toRequiredApproverRole(a.approver_role))
          .filter((r): r is RequiredApproverRole => r !== null),
      ),
    );

    const rejectedApproval = approvals
      .filter((a) => a.status === "rejected")
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
      )[0];
    const rejectedByProfile = rejectedApproval
      ? Array.isArray(rejectedApproval.approver)
        ? rejectedApproval.approver[0]
        : rejectedApproval.approver
      : null;

    const items = (
      Array.isArray(row.purchase_order_items) ? row.purchase_order_items : []
    )
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unitCost: item.unit_cost === null ? null : Number(item.unit_cost),
        lineTotal: Number(item.line_total),
      }));

    return {
      id: row.id,
      quotationId: row.quotation_id ?? null,
      poNumber: row.po_number,
      clientPoNumber: row.client_po_number ?? null,
      quotationReference:
        ((row as Record<string, unknown>).quotation_reference as string | null) ?? null,
      clientId: row.client_id,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      poAmount: Number(row.po_amount),
      cost: numberOrNull(row.cost),
      items,
      marginPercentage: numberOrNull(row.margin_percentage),
      marginAmount: numberOrNull(row.margin_amount),
      bankPercentage: numberOrNull(row.bank_percentage),
      bankAmount: numberOrNull(row.bank_amount),
      sopPercentage: numberOrNull(row.sop_percentage),
      sopAmount: numberOrNull(row.sop_amount),
      sellingAmount: numberOrNull(row.selling_amount),
      recognizedAmount: Number(row.recognized_amount ?? 0),
      paymentStatus: row.payment_status ?? "unpaid",
      paymentTerms: row.payment_terms ?? null,
      paymentTermsCustom: row.payment_terms_custom ?? null,
      leadTimeDays: numberOrNull(row.lead_time_days),
      salesMarginPercent: numberOrNull(row.margin_percentage),
      status: (row.status ?? "pending") as PurchaseOrderStatus,
      pendingApprovalRoles,
      rejectionReason: rejectedApproval?.rejection_reason ?? null,
      rejectedByName: resolveDisplayName(rejectedByProfile),
      approvedAt: row.approved_at ?? null,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: resolveDisplayName(creator) ?? "Unknown",
      itemCount: items.length,
    };
  });
}

/**
 * Step 2 of the PO flow: record the client's PO and re-open the approved
 * quotation so sales can adjust pricing before converting.
 */
export async function markClientPoReceived(input: {
  quotationId: string;
  clientPoNumber: string;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: quotation, error: quotationError } = await supabase
    .from("quotations")
    .select("id, status, phase, converted_po_id")
    .eq("id", input.quotationId)
    .single();

  if (quotationError || !quotation) {
    throw new Error("Quotation was not found.");
  }

  if (quotation.phase !== "sales" || quotation.status !== "approved") {
    throw new Error("Only approved quotations can be re-opened for a client PO.");
  }

  if (quotation.converted_po_id) {
    throw new Error("This quotation has already been converted to a purchase order.");
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      client_po_number: input.clientPoNumber,
      client_confirmed_at: new Date().toISOString(),
    })
    .eq("id", input.quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to record the client PO.");
  }
}

/**
 * Step 3-4 of the PO flow: snapshot the (re-opened, edited) approved quotation
 * into a purchase_orders row and route it through po_approvals using the same
 * >=3M role thresholds as quotations.
 */
export async function convertQuotationToPurchaseOrder(
  quotationId: string,
): Promise<{ purchaseOrderId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: q, error: qError } = await supabase
    .from("quotations")
    .select(
      "id, status, phase, client_id, sector, subject, amount, cost, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount, payment_terms, payment_terms_custom, lead_time_days, client_po_number, client_confirmed_at, converted_po_id, quotation_items(description, quantity, unit_cost, sort_order)",
    )
    .eq("id", quotationId)
    .single();

  if (qError || !q) {
    throw new Error("Quotation was not found.");
  }

  if (q.phase !== "sales" || q.status !== "approved") {
    throw new Error("Only approved quotations can be converted to a purchase order.");
  }

  if (!q.client_confirmed_at) {
    throw new Error("Record the client's PO before converting to a purchase order.");
  }

  if (q.converted_po_id) {
    throw new Error("This quotation has already been converted to a purchase order.");
  }

  const poAmount = Number(q.amount);

  const year = new Date().getFullYear();
  const { count: poCount } = await supabase
    .from("purchase_orders")
    .select("*", { count: "exact", head: true })
    .like("po_number", `PO-${year}-%`);
  const seq = String((poCount ?? 0) + 1).padStart(4, "0");
  let poNumber = `PO-${year}-${seq}`;

  const poPayload = {
    po_number: poNumber,
    quotation_id: q.id,
    client_id: q.client_id,
    sector: q.sector,
    subject: q.subject,
    po_amount: poAmount,
    cost: q.cost,
    margin_percentage: q.margin_percentage,
    margin_amount: q.margin_amount,
    // margin_percent is a GENERATED column; do not insert.
    bank_percentage: q.bank_percentage,
    bank_amount: q.bank_amount,
    sop_percentage: q.sop_percentage,
    sop_amount: q.sop_amount,
    selling_amount: q.selling_amount,
    payment_terms: q.payment_terms,
    payment_terms_custom: q.payment_terms_custom,
    lead_time_days: q.lead_time_days,
    client_po_number: q.client_po_number,
    status: "pending",
    submitted_at: new Date().toISOString(),
    created_by: user.id,
  };

  let { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .insert(poPayload)
    .select("id")
    .single();

  if (poError?.code === "23505") {
    // Unique violation on po_number — retry with next sequence number.
    poNumber = `PO-${year}-${String((poCount ?? 0) + 2).padStart(4, "0")}`;
    ({ data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({ ...poPayload, po_number: poNumber })
      .select("id")
      .single());
  }

  if (poError || !po) {
    throw new Error(poError?.message || "Failed to create the purchase order.");
  }

  const sourceItems = Array.isArray(q.quotation_items) ? q.quotation_items : [];
  if (sourceItems.length > 0) {
    const { error: itemsError } = await supabase.from("purchase_order_items").insert(
      sourceItems.map((item) => ({
        purchase_order_id: po.id,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        sort_order: item.sort_order ?? 0,
      })),
    );
    if (itemsError) {
      throw new Error(
        itemsError.message || "Failed to copy line items to the purchase order.",
      );
    }
  }

  const roles = requiredApproverRolesForAmount(poAmount);
  const rows: Array<{
    po_id: string;
    approver_id: string;
    approver_role: RequiredApproverRole;
    status: "pending";
  }> = [];

  for (const role of roles) {
    const approvers = await findApproversForRole(role);
    for (const approver of approvers) {
      rows.push({
        po_id: po.id,
        approver_id: approver.id,
        approver_role: role,
        status: "pending",
      });
    }
  }

  const { error: approvalError } = await supabase.from("po_approvals").insert(rows);
  if (approvalError) {
    throw new Error(approvalError.message || "Failed to create PO approval assignments.");
  }

  const { error: linkError } = await supabase
    .from("quotations")
    .update({
      converted_po_id: po.id,
      po_converted_at: new Date().toISOString(),
      status: "closed",
    })
    .eq("id", q.id);

  if (linkError) {
    throw new Error(
      linkError.message || "Failed to link the purchase order to the quotation.",
    );
  }

  return { purchaseOrderId: po.id };
}

async function refreshPurchaseOrderStatus(poId: string): Promise<void> {
  const supabase = await createClient();
  const { data: approvals, error } = await supabase
    .from("po_approvals")
    .select("status")
    .eq("po_id", poId);

  if (error) {
    throw new Error("Failed to refresh purchase order status.");
  }

  const statuses = (approvals ?? []).map(
    (a) => a.status as "pending" | "approved" | "rejected" | "cancelled",
  );
  const aggregate = aggregateQuotationStatus(statuses);

  await supabase
    .from("purchase_orders")
    .update({
      status: aggregate,
      approved_at: aggregate === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", poId);
}

export async function findPendingPoApprovalForRole(input: {
  poId: string;
  role: RequiredApproverRole;
}): Promise<{ approvalId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await supabase
    .from("po_approvals")
    .select("id")
    .eq("po_id", input.poId)
    .eq("approver_id", user.id)
    .eq("approver_role", input.role)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw new Error("Failed to verify PO approval assignment.");
  }

  return data ? { approvalId: data.id } : null;
}

export async function listPendingPoApprovalsForCurrentUser(): Promise<
  PendingPoApprovalItem[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("po_approvals")
    .select(
      "id, po_id, approver_role, status, purchase_orders:po_id(po_number, subject, po_amount, cost, margin_amount, sector, po_date, clients:client_id(company_name), creator:created_by(full_name, email))",
    )
    .eq("approver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load pending PO approvals.");
  }

  return (data ?? []).map((row) => {
    const po = Array.isArray(row.purchase_orders)
      ? row.purchase_orders[0]
      : row.purchase_orders;
    const client = po ? (Array.isArray(po.clients) ? po.clients[0] : po.clients) : null;
    const creator = po ? (Array.isArray(po.creator) ? po.creator[0] : po.creator) : null;

    return {
      approvalId: row.id,
      poId: row.po_id,
      poNumber: po?.po_number ?? "",
      subject: po?.subject ?? "",
      amount: Number(po?.po_amount ?? 0),
      approverRole: row.approver_role,
      status: row.status,
      clientName: client?.company_name ?? undefined,
      cost: po?.cost === null || po?.cost === undefined ? null : Number(po.cost),
      marginAmount:
        po?.margin_amount === null || po?.margin_amount === undefined
          ? null
          : Number(po.margin_amount),
      sector: po?.sector ?? null,
      poDate: po?.po_date ?? null,
      createdByName: resolveDisplayName(creator) ?? undefined,
    };
  });
}

export async function approvePoApproval(input: {
  poId: string;
  approvalId: string;
  note?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("po_approvals")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      notes: input.note ?? null,
      rejection_reason: null,
    })
    .eq("id", input.approvalId);

  if (error) {
    throw new Error(error.message || "Failed to approve purchase order.");
  }

  await refreshPurchaseOrderStatus(input.poId);
}

export async function rejectPoApproval(input: {
  poId: string;
  approvalId: string;
  reason: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error: approvalError } = await supabase
    .from("po_approvals")
    .update({
      status: "rejected",
      rejection_reason: input.reason,
      approved_at: null,
    })
    .eq("id", input.approvalId);

  if (approvalError) {
    throw new Error(approvalError.message || "Failed to reject purchase order.");
  }

  // Return PO to rejected so the owner can edit its pricing and resubmit.
  const { error: poError } = await supabase
    .from("purchase_orders")
    .update({ status: "rejected" })
    .eq("id", input.poId);

  if (poError) {
    throw new Error(poError.message || "Failed to update purchase order status.");
  }
}

export async function resubmitPurchaseOrderForApproval(poId: string): Promise<void> {
  const supabase = await createClient();

  const { data: po, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id, status, po_amount")
    .eq("id", poId)
    .single();

  if (fetchError || !po) {
    throw new Error("Purchase order was not found.");
  }

  if (po.status !== "rejected") {
    throw new Error("Only rejected purchase orders can be resubmitted.");
  }

  const { error: poError } = await supabase
    .from("purchase_orders")
    .update({ status: "pending", submitted_at: new Date().toISOString() })
    .eq("id", poId);

  if (poError) {
    throw new Error(poError.message || "Failed to resubmit purchase order.");
  }

  // Clear previous approval rows and create fresh ones.
  await supabase.from("po_approvals").delete().eq("po_id", poId);

  const roles = requiredApproverRolesForAmount(Number(po.po_amount));
  const rows: Array<{
    po_id: string;
    approver_id: string;
    approver_role: RequiredApproverRole;
    status: "pending";
  }> = [];

  for (const role of roles) {
    const approvers = await findApproversForRole(role);
    for (const approver of approvers) {
      rows.push({
        po_id: poId,
        approver_id: approver.id,
        approver_role: role,
        status: "pending",
      });
    }
  }

  if (rows.length > 0) {
    const { error: approvalError } = await supabase.from("po_approvals").insert(rows);
    if (approvalError) {
      throw new Error(
        approvalError.message || "Failed to create PO approval assignments.",
      );
    }
  }
}

/**
 * Editing step for a rejected PO: re-price it (margin/bank/sop %, lead time,
 * payment terms) and update its references, ahead of resubmitting for approval.
 * Only permitted while the PO is in the `rejected` state.
 */
export async function updatePurchaseOrderDetails(input: {
  purchaseOrderId: string;
  marginPercentage: number | null;
  bankPercentage: number | null;
  sopPercentage: number | null;
  paymentTerms: string | null;
  paymentTermsCustom: string | null;
  leadTimeDays: number | null;
  clientPoNumber: string | null;
  quotationReference: string | null;
}): Promise<void> {
  const supabase = await createClient();

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("id, status, cost")
    .eq("id", input.purchaseOrderId)
    .single();

  if (poError || !po) {
    throw new Error("Purchase order was not found.");
  }

  if (po.status !== "rejected") {
    throw new Error("Only rejected purchase orders can be edited.");
  }

  const directCost = Number(po.cost ?? 0);
  const pricing = computeSalesPricing({
    directCost,
    marginPercentage: input.marginPercentage ?? 0,
    bankPercentage: input.bankPercentage ?? 0,
    sopPercentage: input.sopPercentage ?? 0,
  });

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      margin_percentage: input.marginPercentage,
      margin_amount: pricing.marginAmount,
      bank_percentage: input.bankPercentage,
      bank_amount: pricing.bankAmount,
      sop_percentage: input.sopPercentage,
      sop_amount: pricing.sopAmount,
      selling_amount: pricing.sellingAmount,
      po_amount: pricing.sellingAmount,
      payment_terms: input.paymentTerms,
      payment_terms_custom: input.paymentTermsCustom,
      lead_time_days: input.leadTimeDays,
      client_po_number: input.clientPoNumber ? input.clientPoNumber.toUpperCase() : null,
      quotation_reference: input.quotationReference
        ? input.quotationReference.toUpperCase()
        : null,
    })
    .eq("id", input.purchaseOrderId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update purchase order details.");
  }
}

export async function listPoPayments(
  purchaseOrderId?: string,
): Promise<SalesPoPayment[]> {
  const supabase = await createClient();
  let query = supabase
    .from("po_payments")
    .select(
      "id, po_id, purchase_order_id, amount_collected, payment_date, payment_method, reference_number",
    )
    .order("created_at", { ascending: false });

  if (purchaseOrderId) {
    query = query.eq("purchase_order_id", purchaseOrderId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Failed to load PO payments.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    poId: row.po_id,
    purchaseOrderId: row.purchase_order_id ?? null,
    amountCollected: Number(row.amount_collected),
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
  }));
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Loads a purchase order, asserting it exists, is owned by `userId`, and is
 * `approved`. Collections may only be recorded/edited/deleted by the owning
 * sales person against an approved PO — RLS on `po_payments` only checks
 * department membership, not ownership, so this must be enforced here.
 */
async function loadOwnedApprovedPurchaseOrder(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  userId: string,
) {
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("id, quotation_id, po_amount, status, recognized_amount, created_by")
    .eq("id", purchaseOrderId)
    .single();

  if (error || !po) {
    throw new Error("Purchase order was not found.");
  }

  if (po.created_by !== userId) {
    throw new Error("Only the purchase order owner can manage collections.");
  }

  if (po.status !== "approved") {
    throw new Error("Payments can only be recorded against approved purchase orders.");
  }

  return po;
}

/**
 * Re-sums all payments for a purchase order and writes the recognized amount
 * and payment status back onto it. There is no DB trigger keeping
 * `purchase_orders` in sync with `purchase_order_id`-linked payments (only a
 * legacy trigger syncing `quotations` via `po_id`), so every mutation to
 * `po_payments` must call this afterward.
 */
async function recomputeAndSyncPoTotals(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  poAmount: number,
): Promise<void> {
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("po_payments")
    .select("amount_collected")
    .eq("purchase_order_id", purchaseOrderId);

  if (paymentsError) {
    throw new Error(paymentsError.message || "Failed to refresh PO totals.");
  }

  const refreshedRecognizedAmount = (paymentRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount_collected ?? 0),
    0,
  );

  assertCollectionDoesNotExceedPo(poAmount, refreshedRecognizedAmount);

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      recognized_amount: refreshedRecognizedAmount,
      payment_status: derivePaymentStatus(poAmount, refreshedRecognizedAmount),
    })
    .eq("id", purchaseOrderId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update PO totals.");
  }
}

/** Record a collection against an approved purchase order. */
export async function addPoPayment(input: {
  purchaseOrderId: string;
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

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const po = await loadOwnedApprovedPurchaseOrder(
    supabase,
    input.purchaseOrderId,
    user.id,
  );

  const poAmount = Number(po.po_amount);
  const currentRecognized = Number(po.recognized_amount ?? 0);
  assertCollectionDoesNotExceedPo(poAmount, currentRecognized + input.amountCollected);

  const { error } = await supabase.from("po_payments").insert({
    purchase_order_id: po.id,
    // po_id (-> quotations) retained for FK continuity with legacy payments.
    po_id: po.quotation_id,
    amount_collected: input.amountCollected,
    payment_date: input.paymentDate || new Date().toISOString().slice(0, 10),
    payment_method: input.paymentMethod ?? null,
    reference_number: input.referenceNumber ?? null,
    notes: input.notes ?? null,
    recorded_by: user.id,
  });

  if (error) {
    throw new Error(error.message || "Failed to add PO payment.");
  }

  await recomputeAndSyncPoTotals(supabase, po.id, poAmount);
}

/** Update the amount of an existing collection record. */
export async function updatePoPayment(input: {
  paymentId: string;
  purchaseOrderId: string;
  amountCollected: number;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const po = await loadOwnedApprovedPurchaseOrder(
    supabase,
    input.purchaseOrderId,
    user.id,
  );

  const { data: payment, error: paymentError } = await supabase
    .from("po_payments")
    .select("id, amount_collected, purchase_order_id")
    .eq("id", input.paymentId)
    .single();

  if (paymentError || !payment || payment.purchase_order_id !== po.id) {
    throw new Error("Collection record was not found.");
  }

  const poAmount = Number(po.po_amount);
  const projectedTotal =
    Number(po.recognized_amount ?? 0) -
    Number(payment.amount_collected) +
    input.amountCollected;
  assertCollectionDoesNotExceedPo(poAmount, projectedTotal);

  const { error: updateError } = await supabase
    .from("po_payments")
    .update({ amount_collected: input.amountCollected })
    .eq("id", input.paymentId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update the collection.");
  }

  await recomputeAndSyncPoTotals(supabase, po.id, poAmount);
}

/** Delete an existing collection record. */
export async function deletePoPayment(input: {
  paymentId: string;
  purchaseOrderId: string;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const po = await loadOwnedApprovedPurchaseOrder(
    supabase,
    input.purchaseOrderId,
    user.id,
  );

  const { data: payment, error: paymentError } = await supabase
    .from("po_payments")
    .select("id, purchase_order_id")
    .eq("id", input.paymentId)
    .single();

  if (paymentError || !payment || payment.purchase_order_id !== po.id) {
    throw new Error("Collection record was not found.");
  }

  const { error: deleteError } = await supabase
    .from("po_payments")
    .delete()
    .eq("id", input.paymentId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete the collection.");
  }

  await recomputeAndSyncPoTotals(supabase, po.id, Number(po.po_amount));
}
