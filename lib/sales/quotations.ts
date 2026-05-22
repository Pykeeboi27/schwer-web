import { computeSalesPricing } from "@/lib/sales/pricing";
import { createClient } from "@/lib/supabase/server";

export type RequiredApproverRole = "sales_manager" | "owner" | "executive";

export type SalesQuotation = {
  id: string;
  quotationNumber: string;
  clientId: string;
  clientName: string;
  subject: string;
  amount: number;
  cost: number | null;
  googleDriveLink: string | null;
  notes: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled";
  preparedBy: string;
  pendingApprovalRoles: RequiredApproverRole[];
  createdAt: string;
  costingApprovedAt: string | null;
  salesMarginPercent: number | null;
  marginPercentage: number | null;
  marginAmount: number | null;
  bankPercentage: number | null;
  bankAmount: number | null;
  sopPercentage: number | null;
  sopAmount: number | null;
  sellingAmount: number | null;
  paymentTerms: string | null;
  paymentTermsCustom: string | null;
  leadTimeDays: number | null;
  clientPoNumber: string | null;
  clientConfirmedAt: string | null;
  convertedPoId: string | null;
  convertedPoStatus: "draft" | "pending" | "approved" | "rejected" | "cancelled" | null;
  poConvertedAt: string | null;
};

export type PendingApprovalItem = {
  approvalId: string;
  quotationId: string;
  quotationNumber: string;
  subject: string;
  amount: number;
  approverRole: string;
  status: string;
};

export async function fetchQuotations(_departmentId?: string): Promise<SalesQuotation[]> {
  void _departmentId;
  // Department filtering is enforced through RLS for the current session.
  return listSalesQuotations();
}

function toRequiredApproverRole(role: unknown): RequiredApproverRole | null {
  const normalized = String(role ?? "").trim().toLowerCase();

  if (
    normalized === "sales_manager" ||
    normalized === "owner" ||
    normalized === "executive"
  ) {
    return normalized;
  }

  return null;
}

function toUniqueRoles(roles: RequiredApproverRole[]): RequiredApproverRole[] {
  return Array.from(new Set(roles));
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function parseQuotationAmount(raw: unknown): number {
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Quotation amount must be greater than 0.");
  }

  return value;
}

export function parseSalesMarginPercent(raw: unknown): number {
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Margin percent must be between 0 and 100.");
  }

  return value;
}

export function parsePercentInput(raw: unknown, label: string): number {
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }

  return value;
}

export function parseLeadTimeDays(raw: unknown): number {
  const value = Number(raw);

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error("Lead time must be a whole number of days (0 or greater).");
  }

  return value;
}

export function requiresExecutiveApproval(amount: number): boolean {
  return amount >= 3_000_000;
}

export function determineApprovalLevel(
  amount: number,
): "sales_manager_only" | "sales_manager_owner_executive" {
  return requiresExecutiveApproval(amount)
    ? "sales_manager_owner_executive"
    : "sales_manager_only";
}

export function requiredApproverRolesForAmount(amount: number): RequiredApproverRole[] {
  if (requiresExecutiveApproval(amount)) {
    return ["sales_manager", "owner", "executive"];
  }

  return ["sales_manager"];
}

export function aggregateQuotationStatus(
  statuses: Array<"pending" | "approved" | "rejected" | "cancelled">,
): "pending" | "approved" | "rejected" {
  if (statuses.includes("rejected")) {
    return "rejected";
  }

  if (statuses.every((status) => status === "approved" || status === "cancelled")) {
    return "approved";
  }

  return "pending";
}

export async function listSalesQuotations(): Promise<SalesQuotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, client_id, subject, amount, cost, google_drive_link, notes, status, prepared_by, created_at, costing_approved_at, sales_margin_percent, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount, payment_terms, payment_terms_custom, lead_time_days, client_po_number, client_confirmed_at, converted_po_id, po_converted_at, clients:client_id(company_name), converted_po:converted_po_id(status), quotation_approvals(approver_role, status)",
    )
    .eq("phase", "sales")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load quotations.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const approvals = Array.isArray(row.quotation_approvals)
      ? row.quotation_approvals
      : [];

    const pendingApprovalRoles = toUniqueRoles(
      approvals
        .filter((approval) => approval.status === "pending")
        .map((approval) => toRequiredApproverRole(approval.approver_role))
        .filter((role): role is RequiredApproverRole => role !== null),
    );

    return {
      id: row.id,
      quotationNumber: row.quotation_number,
      clientId: row.client_id,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      amount: Number(row.amount),
      cost: row.cost === null ? null : Number(row.cost),
      googleDriveLink: row.google_drive_link,
      notes: row.notes,
      status: row.status,
      preparedBy: row.prepared_by,
      pendingApprovalRoles,
      createdAt: row.created_at,
      costingApprovedAt: row.costing_approved_at ?? null,
      salesMarginPercent:
        row.sales_margin_percent === null || row.sales_margin_percent === undefined
          ? null
          : Number(row.sales_margin_percent),
      marginPercentage: numberOrNull(row.margin_percentage),
      marginAmount: numberOrNull(row.margin_amount),
      bankPercentage: numberOrNull(row.bank_percentage),
      bankAmount: numberOrNull(row.bank_amount),
      sopPercentage: numberOrNull(row.sop_percentage),
      sopAmount: numberOrNull(row.sop_amount),
      sellingAmount: numberOrNull(row.selling_amount),
      paymentTerms: row.payment_terms ?? null,
      paymentTermsCustom: row.payment_terms_custom ?? null,
      leadTimeDays:
        row.lead_time_days === null || row.lead_time_days === undefined
          ? null
          : Number(row.lead_time_days),
      clientPoNumber: row.client_po_number ?? null,
      clientConfirmedAt: row.client_confirmed_at ?? null,
      convertedPoId: row.converted_po_id ?? null,
      convertedPoStatus: (() => {
        const po = Array.isArray(row.converted_po) ? row.converted_po[0] : row.converted_po;
        return po?.status ?? null;
      })(),
      poConvertedAt: row.po_converted_at ?? null,
    };
  });
}

export async function updateSalesQuotationDetails(input: {
  quotationId: string;
  marginPercentage: number | null;
  bankPercentage: number | null;
  sopPercentage: number | null;
  googleDriveLink: string | null;
  paymentTerms: string | null;
  paymentTermsCustom: string | null;
  leadTimeDays: number | null;
  notes: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: quotationRow, error: quotationError } = await supabase
    .from("quotations")
    .select("id, status, phase, cost, client_confirmed_at, converted_po_id")
    .eq("id", input.quotationId)
    .single();

  if (quotationError || !quotationRow) {
    throw new Error("Quotation was not found.");
  }

  if (quotationRow.phase !== "sales") {
    throw new Error("This quotation is not yet in the sales phase.");
  }

  // Editable while a draft, or once re-opened after the client provides their PO
  // (approved + client_confirmed_at set) and it has not yet been converted.
  const isReopenedForPo =
    quotationRow.status === "approved" &&
    quotationRow.client_confirmed_at !== null &&
    quotationRow.converted_po_id === null;

  if (quotationRow.status !== "draft" && !isReopenedForPo) {
    throw new Error("Sales details can only be edited while the quotation is a draft or re-opened for a PO.");
  }

  const directCost = Number(quotationRow.cost ?? 0);
  const pricing = computeSalesPricing({
    directCost,
    marginPercentage: input.marginPercentage ?? 0,
    bankPercentage: input.bankPercentage ?? 0,
    sopPercentage: input.sopPercentage ?? 0,
  });

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      // Keep the legacy sales_margin_percent in sync so existing approval
      // checks and displays continue to work.
      sales_margin_percent: input.marginPercentage,
      margin_percentage: input.marginPercentage,
      margin_amount: pricing.marginAmount,
      bank_percentage: input.bankPercentage,
      bank_amount: pricing.bankAmount,
      sop_percentage: input.sopPercentage,
      sop_amount: pricing.sopAmount,
      selling_amount: pricing.sellingAmount,
      amount: pricing.sellingAmount,
      google_drive_link: input.googleDriveLink,
      payment_terms: input.paymentTerms,
      payment_terms_custom: input.paymentTermsCustom,
      lead_time_days: input.leadTimeDays,
      notes: input.notes,
    })
    .eq("id", input.quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update sales details.");
  }
}

export async function findApproversForRole(role: RequiredApproverRole): Promise<Array<{ id: string }>> {
  const supabase = await createClient();
  const department = role === "sales_manager" ? "sales" : "executive";
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", role)
    .eq("department", department)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    throw new Error(`No active approver found for role: ${role}.`);
  }

  return data.map((row) => ({ id: row.id }));
}

export async function submitQuotationForApproval(quotationId: string): Promise<void> {
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
    .select(
      "id, amount, status, phase, sales_margin_percent, payment_terms, lead_time_days",
    )
    .eq("id", quotationId)
    .single();

  if (quotationError || !quotation) {
    throw new Error("Quotation was not found.");
  }

  if (quotation.phase !== "sales") {
    throw new Error("This quotation is not yet in the sales phase.");
  }

  if (quotation.status !== "draft") {
    throw new Error("Only draft quotations can be submitted for approval.");
  }

  if (
    quotation.sales_margin_percent === null ||
    quotation.sales_margin_percent === undefined ||
    !quotation.payment_terms ||
    String(quotation.payment_terms).trim() === "" ||
    quotation.lead_time_days === null ||
    quotation.lead_time_days === undefined
  ) {
    throw new Error(
      "Margin, payment terms, and lead time are required before submitting.",
    );
  }

  const roles = requiredApproverRolesForAmount(Number(quotation.amount));
  const rows = [] as Array<{
    quotation_id: string;
    approver_id: string;
    approver_role: RequiredApproverRole;
    status: "pending";
  }>;

  for (const role of roles) {
    const approvers = await findApproversForRole(role);

    for (const approver of approvers) {
      rows.push({
        quotation_id: quotationId,
        approver_id: approver.id,
        approver_role: role,
        status: "pending",
      });
    }
  }

  const { error: insertError } = await supabase.from("quotation_approvals").insert(rows);
  if (insertError) {
    throw new Error(insertError.message || "Failed to create approval assignments.");
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({ status: "pending" })
    .eq("id", quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to submit quotation.");
  }
}

export async function findPendingApprovalForRole(input: {
  quotationId: string;
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
    .from("quotation_approvals")
    .select("id")
    .eq("quotation_id", input.quotationId)
    .eq("approver_id", user.id)
    .eq("approver_role", input.role)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw new Error("Failed to verify approval assignment.");
  }

  if (!data) {
    return null;
  }

  return { approvalId: data.id };
}

export async function listPendingApprovalsForCurrentUser(): Promise<PendingApprovalItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("quotation_approvals")
    .select("id, quotation_id, approver_role, status, quotations:quotation_id(quotation_number, subject, amount)")
    .eq("approver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load pending approvals.");
  }

  return (data ?? []).map((row) => {
    const quotation = Array.isArray(row.quotations) ? row.quotations[0] : row.quotations;

    return {
      approvalId: row.id,
      quotationId: row.quotation_id,
      quotationNumber: quotation?.quotation_number ?? "",
      subject: quotation?.subject ?? "",
      amount: Number(quotation?.amount ?? 0),
      approverRole: row.approver_role,
      status: row.status,
    };
  });
}

export async function approveQuotationApproval(input: {
  approvalId: string;
  note?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotation_approvals")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      notes: input.note ?? null,
      rejection_reason: null,
    })
    .eq("id", input.approvalId);

  if (error) {
    throw new Error(error.message || "Failed to approve quotation.");
  }
}

export async function rejectQuotationApproval(input: {
  approvalId: string;
  reason: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotation_approvals")
    .update({
      status: "rejected",
      rejection_reason: input.reason,
      approved_at: null,
    })
    .eq("id", input.approvalId);

  if (error) {
    throw new Error(error.message || "Failed to reject quotation.");
  }
}
