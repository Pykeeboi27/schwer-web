import {
  approvalChainForAmount,
  buildApprovalStages,
  findApproversForRole,
  type ApprovalStage,
  type RequiredApproverRole,
} from "@/lib/sales/quotations";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { canEncodeExistingPurchaseOrders } from "@/lib/sales/access";
import { computeLandedUnitCost } from "@/lib/engineering/landed-cost";
import {
  computeAggregatePricing,
  computeSalesPricing,
  repriceStoredItems,
  round2,
} from "@/lib/sales/pricing";
import { PROOF_OF_PAYMENT_BUCKET } from "@/lib/sales/proof-of-payment";
import { createClient } from "@/lib/supabase/server";
import { validatePoTotalAmount } from "@/lib/utils/form-validation";

// Re-exported for callers that already import from this module; defined in
// lib/sales/po-labels.ts (a client-safe module with no server-only imports)
// -- see that file's comment for why. Applied at the data layer below so
// every UI surface inherits it uniformly; created_by/encoded_by still hold
// the real user id for audit and are never mutated.
import { ENCODED_PO_AUTHOR_LABEL } from "@/lib/sales/po-labels";
export { ENCODED_PO_AUTHOR_LABEL };

export type PurchaseOrderStatus =
  "draft" | "pending" | "approved" | "rejected" | "cancelled";

export type SalesPurchaseOrderItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
  marginPercentage: number | null;
  marginAmount: number | null;
  bankPercentage: number | null;
  bankAmount: number | null;
  sopPercentage: number | null;
  sopAmount: number | null;
  sellingAmount: number | null;
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
  hasUnequalMargins: boolean;
  recognizedAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid" | "overdue";
  paymentTerms: string | null;
  paymentTermsCustom: string | null;
  leadTimeDays: number | null;
  salesMarginPercent: number | null;
  status: PurchaseOrderStatus;
  pendingApprovalRoles: RequiredApproverRole[];
  approvalStages: ApprovalStage[];
  rejectionReason: string | null;
  rejectedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  itemCount: number;
  /** True for standalone POs backfilled via Existing Purchase Order Encoding. */
  isManuallyEncoded: boolean;
};

export type SalesPoPayment = {
  id: string;
  poId: string;
  purchaseOrderId: string | null;
  amountCollected: number;
  paymentDate: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  /** Storage path of the proof-of-payment image, or null for legacy rows. */
  proofPath: string | null;
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
      "id, quotation_id, po_number, client_po_number, quotation_reference, client_id, subject, po_amount, cost, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount, has_unequal_margins, recognized_amount, payment_status, payment_terms, payment_terms_custom, lead_time_days, status, approved_at, created_at, created_by, is_manually_encoded, clients:client_id(company_name), po_approvals(approver_role, status, rejection_reason, updated_at, approver:approver_id(full_name, email)), creator:created_by(full_name, email), purchase_order_items(id, description, quantity, unit_cost, line_total, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount, sort_order)",
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

    const approvalStages = buildApprovalStages(
      Number(row.po_amount),
      approvals
        .map((a) => ({ role: toRequiredApproverRole(a.approver_role), status: a.status }))
        .filter(
          (a): a is { role: RequiredApproverRole; status: string } => a.role !== null,
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

    const storedItems = (
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
        marginPercentage: numberOrNull(item.margin_percentage),
        bankPercentage: numberOrNull(item.bank_percentage),
        sopPercentage: numberOrNull(item.sop_percentage),
      }));

    // Recomputed from stored cost + percentages rather than trusting the
    // persisted *_amount columns -- see repriceStoredItems for why. This also
    // drives the displayed headline poAmount below; the stored row.po_amount
    // used for approvalStages above is left alone since that reflects the
    // amount the approval chain actually ran against historically.
    const repriced = repriceStoredItems(
      storedItems.map((item) => ({
        directCost: item.lineTotal,
        quantity: item.quantity,
        marginPercentage: item.marginPercentage,
        bankPercentage: item.bankPercentage,
        sopPercentage: item.sopPercentage,
      })),
    );

    const items = storedItems.map((item, index) => ({
      ...item,
      ...repriced.items[index],
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
      poAmount: repriced.aggregate
        ? repriced.aggregate.sellingAmount
        : Number(row.po_amount),
      cost: numberOrNull(row.cost),
      items,
      marginPercentage: numberOrNull(row.margin_percentage),
      marginAmount: repriced.aggregate
        ? repriced.aggregate.marginAmount
        : numberOrNull(row.margin_amount),
      bankPercentage: numberOrNull(row.bank_percentage),
      bankAmount: repriced.aggregate
        ? repriced.aggregate.bankAmount
        : numberOrNull(row.bank_amount),
      sopPercentage: numberOrNull(row.sop_percentage),
      sopAmount: repriced.aggregate
        ? repriced.aggregate.sopAmount
        : numberOrNull(row.sop_amount),
      sellingAmount: repriced.aggregate
        ? repriced.aggregate.sellingAmount
        : numberOrNull(row.selling_amount),
      hasUnequalMargins: Boolean(row.has_unequal_margins),
      recognizedAmount: Number(row.recognized_amount ?? 0),
      paymentStatus: row.payment_status ?? "unpaid",
      paymentTerms: row.payment_terms ?? null,
      paymentTermsCustom: row.payment_terms_custom ?? null,
      leadTimeDays: numberOrNull(row.lead_time_days),
      salesMarginPercent: numberOrNull(row.margin_percentage),
      status: (row.status ?? "pending") as PurchaseOrderStatus,
      pendingApprovalRoles,
      approvalStages,
      rejectionReason: rejectedApproval?.rejection_reason ?? null,
      rejectedByName: resolveDisplayName(rejectedByProfile),
      approvedAt: row.approved_at ?? null,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.is_manually_encoded
        ? ENCODED_PO_AUTHOR_LABEL
        : (resolveDisplayName(creator) ?? "Unknown"),
      itemCount: items.length,
      isManuallyEncoded: Boolean(row.is_manually_encoded),
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
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();

  // The guard (phase='sales', status='approved', not yet converted) is folded
  // into the UPDATE's WHERE clause rather than a separate SELECT-then-UPDATE.
  const { data, error: updateError } = await supabase
    .from("quotations")
    .update({
      client_po_number: input.clientPoNumber,
      client_confirmed_at: new Date().toISOString(),
    })
    .eq("id", input.quotationId)
    .eq("phase", "sales")
    .eq("status", "approved")
    .is("converted_po_id", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message || "Failed to record the client PO.");
  }

  if (!data) {
    throw new Error(
      "Only approved quotations that haven't been converted yet can be re-opened for a client PO.",
    );
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
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();

  const { data: q, error: qError } = await supabase
    .from("quotations")
    .select(
      "id, status, phase, client_id, sector, subject, amount, cost, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount, has_unequal_margins, payment_terms, payment_terms_custom, lead_time_days, client_po_number, client_confirmed_at, converted_po_id, quotation_items(description, quantity, raw_cost, unit_cost, sort_order, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount)",
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
    has_unequal_margins: q.has_unequal_margins,
    payment_terms: q.payment_terms,
    payment_terms_custom: q.payment_terms_custom,
    lead_time_days: q.lead_time_days,
    client_po_number: q.client_po_number,
    status: "pending",
    submitted_at: new Date().toISOString(),
    created_by: profile.id,
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
        raw_cost: item.raw_cost,
        unit_cost: item.unit_cost,
        sort_order: item.sort_order ?? 0,
        margin_percentage: item.margin_percentage,
        margin_amount: item.margin_amount,
        bank_percentage: item.bank_percentage,
        bank_amount: item.bank_amount,
        sop_percentage: item.sop_percentage,
        sop_amount: item.sop_amount,
        selling_amount: item.selling_amount,
      })),
    );
    if (itemsError) {
      throw new Error(
        itemsError.message || "Failed to copy line items to the purchase order.",
      );
    }
  }

  // Sequential chain: only the first stage is seeded here. Approving it
  // opens the next stage (fn_sync_po_status_from_approvals in schema.sql), so
  // a role never sees this PO in its approval queue before its turn.
  const [firstRole] = approvalChainForAmount(poAmount);
  const firstStageApprovers = await findApproversForRole(firstRole);
  const rows: Array<{
    po_id: string;
    approver_id: string;
    approver_role: RequiredApproverRole;
    status: "pending";
  }> = firstStageApprovers.map((approver) => ({
    po_id: po.id,
    approver_id: approver.id,
    approver_role: firstRole,
    status: "pending",
  }));

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

export async function findPendingPoApprovalForRole(input: {
  poId: string;
  role: RequiredApproverRole;
}): Promise<{ approvalId: string } | null> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_approvals")
    .select("id")
    .eq("po_id", input.poId)
    .eq("approver_id", profile.id)
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
  const profile = await getCurrentProfile();
  if (!profile) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_approvals")
    .select(
      "id, po_id, approver_role, status, purchase_orders:po_id(po_number, subject, po_amount, cost, margin_amount, sector, po_date, clients:client_id(company_name), creator:created_by(full_name, email))",
    )
    .eq("approver_id", profile.id)
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

  // Status/approved_at rollup and next-stage row creation are handled by the
  // fn_sync_po_status_from_approvals trigger (schema.sql) in response to this
  // update, not here -- see that trigger for why it must happen atomically
  // with this row's status change rather than as a separate follow-up call.
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
    .select("id, status")
    .eq("id", poId)
    .single();

  if (fetchError || !po) {
    throw new Error("Purchase order was not found.");
  }

  if (po.status !== "rejected") {
    throw new Error("Only rejected purchase orders can be resubmitted.");
  }

  // Deletes the stale approval row(s), seeds the stage-one (sales_manager)
  // approval, and flips status back to pending, all inside one transaction
  // (fn_resubmit_po_for_approval, migrations/0025). Doing this as separate
  // client calls previously left POs stuck at status "pending" with no
  // approval row for anyone to see whenever the last step failed -- see that
  // migration for the full story (same bug as the quotation resubmit flow).
  const { error: rpcError } = await supabase.rpc("fn_resubmit_po_for_approval", {
    p_po_id: poId,
  });

  if (rpcError) {
    throw new Error(rpcError.message || "Failed to resubmit purchase order.");
  }
}

export type PurchaseOrderItemPricingInput = {
  id: string;
  marginPercentage: number | null;
  bankPercentage: number | null;
  sopPercentage: number | null;
};

/**
 * Editing step for a rejected PO: re-price it per item (margin/bank/sop %,
 * lead time, payment terms) and update its references, ahead of resubmitting
 * for approval. Only permitted while the PO is in the `rejected` state.
 */
export async function updatePurchaseOrderDetails(input: {
  purchaseOrderId: string;
  hasUnequalMargins: boolean;
  items: PurchaseOrderItemPricingInput[];
  paymentTerms: string | null;
  paymentTermsCustom: string | null;
  leadTimeDays: number | null;
  clientPoNumber: string | null;
  quotationReference: string | null;
}): Promise<void> {
  const supabase = await createClient();

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("id, status, purchase_order_items(id, line_total, quantity)")
    .eq("id", input.purchaseOrderId)
    .single();

  if (poError || !po) {
    throw new Error("Purchase order was not found.");
  }

  if (po.status !== "rejected") {
    throw new Error("Only rejected purchase orders can be edited.");
  }

  const itemRows = Array.isArray(po.purchase_order_items) ? po.purchase_order_items : [];
  // Direct cost per item is read fresh from the DB rather than trusted from
  // the client. Quantity comes along so computeSalesPricing can recover the
  // per-unit price it rounds against.
  const lineTotalById = new Map(
    itemRows.map((item) => [item.id, Number(item.line_total)]),
  );
  const quantityById = new Map(itemRows.map((item) => [item.id, Number(item.quantity)]));

  if (input.items.length === 0 || input.items.length !== itemRows.length) {
    throw new Error("Every line item on this purchase order needs pricing.");
  }

  const pricedItems = input.items.map((item) => {
    const directCost = lineTotalById.get(item.id);
    if (directCost === undefined) {
      throw new Error("One of the priced items does not belong to this purchase order.");
    }

    const pricing = computeSalesPricing({
      directCost,
      quantity: quantityById.get(item.id),
      marginPercentage: item.marginPercentage ?? 0,
      bankPercentage: item.bankPercentage ?? 0,
      sopPercentage: item.sopPercentage ?? 0,
    });

    return {
      id: item.id,
      directCost,
      marginPercentage: item.marginPercentage,
      bankPercentage: item.bankPercentage,
      sopPercentage: item.sopPercentage,
      ...pricing,
    };
  });

  // Sequential, matching the same rationale as
  // lib/sales/quotations.ts updateSalesQuotationDetails.
  for (const item of pricedItems) {
    const { error: itemError } = await supabase
      .from("purchase_order_items")
      .update({
        margin_percentage: item.marginPercentage,
        margin_amount: item.marginAmount,
        bank_percentage: item.bankPercentage,
        bank_amount: item.bankAmount,
        sop_percentage: item.sopPercentage,
        sop_amount: item.sopAmount,
        selling_amount: item.sellingAmount,
      })
      .eq("id", item.id)
      .eq("purchase_order_id", input.purchaseOrderId);

    if (itemError) {
      throw new Error(itemError.message || "Failed to update an item's pricing.");
    }
  }

  // Blended weighted-average percentages + summed amounts, written back to
  // the record-level columns (same rollup as the quotation-side update). VAT
  // is already resolved within cost and the margin gross-up (see
  // computeSalesPricing) -- `po_amount` is just the aggregate sellingAmount,
  // not sellingAmount plus additional VAT.
  const aggregate = computeAggregatePricing(pricedItems);

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      margin_percentage: aggregate.marginPercentage,
      margin_amount: aggregate.marginAmount,
      bank_percentage: aggregate.bankPercentage,
      bank_amount: aggregate.bankAmount,
      sop_percentage: aggregate.sopPercentage,
      sop_amount: aggregate.sopAmount,
      selling_amount: aggregate.sellingAmount,
      po_amount: aggregate.sellingAmount,
      has_unequal_margins: input.hasUnequalMargins,
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
      "id, po_id, purchase_order_id, amount_collected, payment_date, payment_method, reference_number, proof_path",
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
    proofPath: row.proof_path ?? null,
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
  /** Storage path of the already-uploaded proof-of-payment image. */
  proofPath: string;
}): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();
  const po = await loadOwnedApprovedPurchaseOrder(
    supabase,
    input.purchaseOrderId,
    profile.id,
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
    recorded_by: profile.id,
    proof_path: input.proofPath,
  });

  if (error) {
    throw new Error(error.message || "Failed to add PO payment.");
  }

  await recomputeAndSyncPoTotals(supabase, po.id, poAmount);
}

/** Update the amount (and optionally the proof photo) of an existing collection record. */
export async function updatePoPayment(input: {
  paymentId: string;
  purchaseOrderId: string;
  amountCollected: number;
  /** Storage path of a newly-uploaded proof image. Omitted keeps the existing proof. */
  proofPath?: string;
}): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();
  const po = await loadOwnedApprovedPurchaseOrder(
    supabase,
    input.purchaseOrderId,
    profile.id,
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
    .update({
      amount_collected: input.amountCollected,
      ...(input.proofPath ? { proof_path: input.proofPath } : {}),
    })
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
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();
  const po = await loadOwnedApprovedPurchaseOrder(
    supabase,
    input.purchaseOrderId,
    profile.id,
  );

  // The existence/ownership guard is folded into the DELETE's WHERE clause
  // rather than a separate SELECT-then-DELETE.
  const { data, error: deleteError } = await supabase
    .from("po_payments")
    .delete()
    .eq("id", input.paymentId)
    .eq("purchase_order_id", po.id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete the collection.");
  }

  if (!data) {
    throw new Error("Collection record was not found.");
  }

  await recomputeAndSyncPoTotals(supabase, po.id, Number(po.po_amount));
}

export type EncodeExistingPoItemInput = {
  description: string;
  quantity: number;
  rawCost: number;
  marginPercentage: number;
  bankPercentage: number;
  sopPercentage: number;
};

export type EncodeExistingPoPaymentInput = {
  amountCollected: number;
  /** Real historical payment date (YYYY-MM-DD), not the encoding date. */
  paymentDate: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  /** Storage path of the already-uploaded proof-of-payment image. */
  proofPath: string;
};

export type EncodeExistingPurchaseOrderInput = {
  poNumber: string;
  clientId: string;
  subject: string;
  clientPoNumber: string | null;
  quotationReference: string | null;
  /** Real historical PO date (YYYY-MM-DD) -- becomes po_date/approved_at/submitted_at. */
  poDate: string;
  paymentTerms: string | null;
  paymentTermsCustom: string | null;
  leadTimeDays: number;
  hasUnequalMargins: boolean;
  items: EncodeExistingPoItemInput[];
  payments: EncodeExistingPoPaymentInput[];
};

/**
 * Existing Purchase Order Encoding: backfills an already-existing, already-won
 * PO for record-keeping. No approval workflow, no engineering costing handoff
 * -- sales enters both raw cost and margins themselves, mirroring what
 * setQuotationItemCosts (raw cost) and updatePurchaseOrderDetails (margins)
 * do separately for the live workflow, but computed here in one pass since
 * there's no existing DB row to read a fresh line_total back from between
 * steps. The per-item directCost used for margin math is therefore an
 * estimate (quantity x computeLandedUnitCost(rawCost)) rather than a value
 * read from the DB's GENERATED line_total column -- harmless, because every
 * read path (listPurchaseOrders -> repriceStoredItems) re-derives displayed
 * pricing from the DB's actual line_total plus the stored percentages on
 * every load, so this estimate is only ever the initial stored snapshot.
 *
 * Writes happen in a single transaction via fn_encode_existing_po
 * (migrations/0027) -- see that migration's header comment for why (same
 * "no partial/stuck record" rationale as the resubmit RPCs).
 */
export async function encodeExistingPurchaseOrder(
  input: EncodeExistingPurchaseOrderInput,
): Promise<{ purchaseOrderId: string }> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  if (!canEncodeExistingPurchaseOrders(profile)) {
    throw new Error("Only the coordinator can record existing purchase orders.");
  }

  if (input.items.length === 0) {
    throw new Error("Add at least one line item.");
  }

  const supabase = await createClient();

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("sector")
    .eq("id", input.clientId)
    .single();

  if (clientError || !clientRow) {
    throw new Error("Selected client was not found.");
  }

  const pricedItems = input.items.map((item) => {
    const unitCost = computeLandedUnitCost(item.rawCost);
    const directCost = round2(unitCost * item.quantity);
    const pricing = computeSalesPricing({
      directCost,
      quantity: item.quantity,
      marginPercentage: item.marginPercentage,
      bankPercentage: item.bankPercentage,
      sopPercentage: item.sopPercentage,
    });

    return {
      description: item.description,
      quantity: item.quantity,
      rawCost: item.rawCost,
      unitCost,
      directCost,
      marginPercentage: item.marginPercentage,
      bankPercentage: item.bankPercentage,
      sopPercentage: item.sopPercentage,
      ...pricing,
    };
  });

  const aggregate = computeAggregatePricing(pricedItems);

  const { data: poId, error: rpcError } = await supabase.rpc("fn_encode_existing_po", {
    p_po: {
      po_number: input.poNumber,
      client_id: input.clientId,
      sector: clientRow.sector,
      subject: input.subject,
      cost: aggregate.directCost,
      margin_percentage: aggregate.marginPercentage,
      margin_amount: aggregate.marginAmount,
      bank_percentage: aggregate.bankPercentage,
      bank_amount: aggregate.bankAmount,
      sop_percentage: aggregate.sopPercentage,
      sop_amount: aggregate.sopAmount,
      selling_amount: aggregate.sellingAmount,
      has_unequal_margins: input.hasUnequalMargins,
      payment_terms: input.paymentTerms,
      payment_terms_custom: input.paymentTermsCustom,
      lead_time_days: input.leadTimeDays,
      client_po_number: input.clientPoNumber,
      quotation_reference: input.quotationReference,
      po_date: input.poDate,
    },
    p_items: pricedItems.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      raw_cost: item.rawCost,
      unit_cost: item.unitCost,
      sort_order: index,
      margin_percentage: item.marginPercentage,
      margin_amount: item.marginAmount,
      bank_percentage: item.bankPercentage,
      bank_amount: item.bankAmount,
      sop_percentage: item.sopPercentage,
      sop_amount: item.sopAmount,
      selling_amount: item.sellingAmount,
    })),
    p_payments: input.payments.map((payment) => ({
      amount_collected: payment.amountCollected,
      payment_date: payment.paymentDate,
      payment_method: payment.paymentMethod,
      reference_number: payment.referenceNumber,
      notes: payment.notes,
      proof_path: payment.proofPath,
    })),
  });

  if (rpcError || !poId) {
    if (rpcError?.code === "23505") {
      throw new Error("A purchase order with that PO number already exists.");
    }
    throw new Error(rpcError?.message || "Failed to record the purchase order.");
  }

  return { purchaseOrderId: poId as unknown as string };
}

/**
 * Deletes a manually-encoded PO so a mistaken entry can be re-encoded
 * cleanly. fn_delete_encoded_po (migrations/0027) guards is_manually_encoded
 * itself, so this can never remove a real workflow PO. Any proof-of-payment
 * images are best-effort removed from Storage first, since po_payments rows
 * (and their proof_path values) cease to exist once the PO cascade-deletes.
 */
export async function deleteEncodedPurchaseOrder(purchaseOrderId: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  if (!canEncodeExistingPurchaseOrders(profile)) {
    throw new Error("Only the coordinator can delete a recorded purchase order.");
  }

  const supabase = await createClient();

  const { data: paymentRows } = await supabase
    .from("po_payments")
    .select("proof_path")
    .eq("purchase_order_id", purchaseOrderId);

  const { error } = await supabase.rpc("fn_delete_encoded_po", {
    p_po_id: purchaseOrderId,
  });

  if (error) {
    throw new Error(error.message || "Failed to delete the purchase order.");
  }

  const proofPaths = (paymentRows ?? [])
    .map((row) => row.proof_path)
    .filter((path): path is string => Boolean(path));

  if (proofPaths.length > 0) {
    void supabase.storage.from(PROOF_OF_PAYMENT_BUCKET).remove(proofPaths);
  }
}
