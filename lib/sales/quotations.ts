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
  notes: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled";
  preparedBy: string;
  pendingApprovalRoles: RequiredApproverRole[];
  createdAt: string;
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

export function parseQuotationAmount(raw: unknown): number {
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Quotation amount must be greater than 0.");
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
      "id, quotation_number, client_id, subject, amount, cost, notes, status, prepared_by, created_at, clients:client_id(company_name), quotation_approvals(approver_role, status)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load quotations.");
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
      notes: row.notes,
      status: row.status,
      preparedBy: row.prepared_by,
      pendingApprovalRoles,
      createdAt: row.created_at,
    };
  });
}

export async function createQuotationDraft(input: {
  clientId: string;
  subject: string;
  amount: number;
  cost?: number | null;
  notes?: string | null;
}): Promise<{ quotationId: string }> {
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

  const quotationNumber = `QT-${Date.now()}`;
  const { data, error } = await supabase
    .from("quotations")
    .insert({
      quotation_number: quotationNumber,
      client_id: input.clientId,
      sector: clientRow.sector,
      subject: input.subject,
      amount: input.amount,
      cost: input.cost ?? null,
      notes: input.notes ?? null,
      prepared_by: user.id,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create quotation draft.");
  }

  return { quotationId: data.id };
}

export async function updateQuotationDraft(input: {
  quotationId: string;
  clientId: string;
  subject: string;
  amount: number;
  cost?: number | null;
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

  const { data: quotationRow, error: quotationError } = await supabase
    .from("quotations")
    .select("id, status, prepared_by")
    .eq("id", input.quotationId)
    .single();

  if (quotationError || !quotationRow) {
    throw new Error("Quotation was not found.");
  }

  if (quotationRow.status !== "draft") {
    throw new Error("Only draft quotations can be edited.");
  }

  if (quotationRow.prepared_by !== user.id) {
    throw new Error("Only the quotation creator can edit this draft.");
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("sector")
    .eq("id", input.clientId)
    .single();

  if (clientError || !clientRow) {
    throw new Error("Selected client was not found.");
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      client_id: input.clientId,
      sector: clientRow.sector,
      subject: input.subject,
      amount: input.amount,
      cost: input.cost ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", input.quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update quotation draft.");
  }
}

export async function deleteQuotationDraft(quotationId: string): Promise<void> {
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
    .select("id, status, prepared_by")
    .eq("id", quotationId)
    .single();

  if (quotationError || !quotationRow) {
    throw new Error("Quotation was not found.");
  }

  if (quotationRow.status !== "draft") {
    throw new Error("Only draft quotations can be deleted.");
  }

  if (quotationRow.prepared_by !== user.id) {
    throw new Error("Only the quotation creator can delete this draft.");
  }

  const { error: deleteError } = await supabase
    .from("quotations")
    .delete()
    .eq("id", quotationId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete quotation draft.");
  }
}

async function findApproversForRole(role: RequiredApproverRole): Promise<Array<{ id: string }>> {
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
    .select("id, amount, status, prepared_by")
    .eq("id", quotationId)
    .single();

  if (quotationError || !quotation) {
    throw new Error("Quotation was not found.");
  }

  if (quotation.status !== "draft") {
    throw new Error("Only draft quotations can be submitted for approval.");
  }

  if (quotation.prepared_by !== user.id) {
    throw new Error("Only the quotation creator can submit this quotation for approval.");
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
