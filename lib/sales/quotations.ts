import { computeSalesPricing } from "@/lib/sales/pricing";
import { createClient } from "@/lib/supabase/server";

export type RequiredApproverRole = "sales_manager" | "owner" | "executive";

export type SalesQuotationItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
};

export type SalesQuotation = {
  id: string;
  quotationNumber: string;
  clientId: string;
  clientName: string;
  subject: string;
  amount: number;
  cost: number | null;
  items: SalesQuotationItem[];
  googleDriveLink: string | null;
  notes: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled" | "closed";
  preparedBy: string;
  preparedByName: string;
  salesPersonId: string | null;
  salesPersonName: string | null;
  pendingApprovalRoles: RequiredApproverRole[];
  rejectionReason: string | null;
  rejectedByName: string | null;
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
  clientName?: string;
  cost?: number | null;
  marginAmount?: number | null;
  sector?: string | null;
  googleDriveLink?: string | null;
  notes?: string | null;
  createdAt?: string;
  preparedByName?: string;
};

export async function fetchQuotations(_departmentId?: string): Promise<SalesQuotation[]> {
  void _departmentId;
  // Department filtering is enforced through RLS for the current session.
  return listSalesQuotations();
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

function toUniqueRoles(roles: RequiredApproverRole[]): RequiredApproverRole[] {
  return Array.from(new Set(roles));
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

export type RequestForQuotationItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
};

export type RequestForQuotation = {
  id: string;
  quotationNumber: string;
  clientId: string;
  clientName: string;
  subject: string;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled";
  costingRejectionReason: string | null;
  googleDriveLink: string | null;
  items: RequestForQuotationItem[];
  cost: number | null;
  createdAt: string;
  costingApprovedAt: string | null;
};

export async function createRequestForQuotation(input: {
  quotationNumber: string;
  clientId: string;
  subject: string;
  notes?: string | null;
  items: Array<{ description: string; quantity: number }>;
}): Promise<{ quotationId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  if (input.items.length === 0) {
    throw new Error("Add at least one line item.");
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("sector")
    .eq("id", input.clientId)
    .single();

  if (clientError || !clientRow) {
    throw new Error("Selected client was not found.");
  }

  const { data, error } = await supabase
    .from("quotations")
    .insert({
      quotation_number: input.quotationNumber,
      client_id: input.clientId,
      sector: clientRow.sector,
      subject: input.subject,
      // amount (selling amount) and cost are set later — amount in the sales
      // phase, cost is rolled up from quotation_items as Engineering costs them.
      amount: 0,
      // The requester is always the sales person on their own RFQ.
      sales_person_id: user.id,
      notes: input.notes ?? null,
      prepared_by: user.id,
      status: "draft",
      phase: "costing",
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("Quotation ID already exists. Please choose a different one.");
    }
    throw new Error(error?.message || "Failed to create the request for quotation.");
  }

  const { error: itemsError } = await supabase.from("quotation_items").insert(
    input.items.map((item, index) => ({
      quotation_id: data.id,
      description: item.description,
      quantity: item.quantity,
      sort_order: index,
    })),
  );

  if (itemsError) {
    throw new Error(itemsError.message || "Failed to save line items.");
  }

  return { quotationId: data.id };
}

export async function listRequestsForQuotation(): Promise<RequestForQuotation[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, client_id, subject, status, costing_rejection_reason, google_drive_link, cost, created_at, costing_approved_at, clients:client_id(company_name), quotation_items(id, description, quantity, unit_cost, line_total, sort_order)",
    )
    .eq("phase", "costing")
    .eq("prepared_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load requests for quotation.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const items = (Array.isArray(row.quotation_items) ? row.quotation_items : [])
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
      quotationNumber: row.quotation_number,
      clientId: row.client_id,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      status: row.status,
      costingRejectionReason: row.costing_rejection_reason,
      googleDriveLink: row.google_drive_link,
      items,
      cost: row.cost === null ? null : Number(row.cost),
      createdAt: row.created_at,
      costingApprovedAt: row.costing_approved_at ?? null,
    };
  });
}

export async function listSalesQuotations(): Promise<SalesQuotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, client_id, subject, amount, cost, google_drive_link, notes, status, prepared_by, sales_person_id, created_at, costing_approved_at, sales_margin_percent, margin_percentage, margin_amount, bank_percentage, bank_amount, sop_percentage, sop_amount, selling_amount, payment_terms, payment_terms_custom, lead_time_days, client_po_number, client_confirmed_at, converted_po_id, po_converted_at, clients:client_id(company_name), converted_po:converted_po_id(status), quotation_approvals(approver_role, status, rejection_reason, updated_at, approver:approver_id(full_name, email)), preparer:prepared_by(full_name, email), sales_person:sales_person_id(full_name, email), quotation_items(id, description, quantity, unit_cost, line_total, sort_order)",
    )
    .eq("phase", "sales")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load quotations.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const preparer = Array.isArray(row.preparer) ? row.preparer[0] : row.preparer;
    const salesPerson = Array.isArray(row.sales_person)
      ? row.sales_person[0]
      : row.sales_person;
    const approvals = Array.isArray(row.quotation_approvals)
      ? row.quotation_approvals
      : [];

    const pendingApprovalRoles = toUniqueRoles(
      approvals
        .filter((approval) => approval.status === "pending")
        .map((approval) => toRequiredApproverRole(approval.approver_role))
        .filter((role): role is RequiredApproverRole => role !== null),
    );

    const rejectedApproval = approvals
      .filter((approval) => approval.status === "rejected")
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
      )[0];
    const rejectedByProfile = rejectedApproval
      ? Array.isArray(rejectedApproval.approver)
        ? rejectedApproval.approver[0]
        : rejectedApproval.approver
      : null;

    const items = (Array.isArray(row.quotation_items) ? row.quotation_items : [])
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
      quotationNumber: row.quotation_number,
      clientId: row.client_id,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      amount: Number(row.amount),
      cost: row.cost === null ? null : Number(row.cost),
      items,
      googleDriveLink: row.google_drive_link,
      notes: row.notes,
      status: row.status,
      preparedBy: row.prepared_by,
      preparedByName: resolveDisplayName(preparer) ?? "Unknown",
      salesPersonId: row.sales_person_id ?? null,
      salesPersonName: resolveDisplayName(salesPerson),
      pendingApprovalRoles,
      rejectionReason: rejectedApproval?.rejection_reason ?? null,
      rejectedByName: resolveDisplayName(rejectedByProfile),
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
        const po = Array.isArray(row.converted_po)
          ? row.converted_po[0]
          : row.converted_po;
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

  const isRejected = quotationRow.status === "rejected";

  if (quotationRow.status !== "draft" && !isReopenedForPo && !isRejected) {
    throw new Error(
      "Sales details can only be edited while the quotation is a draft, rejected, or re-opened for a PO.",
    );
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

export async function findApproversForRole(
  role: RequiredApproverRole,
): Promise<Array<{ id: string }>> {
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

function assertQuotationReadyForApproval(row: {
  sales_margin_percent: unknown;
  payment_terms: unknown;
  lead_time_days: unknown;
}): void {
  if (
    row.sales_margin_percent === null ||
    row.sales_margin_percent === undefined ||
    !row.payment_terms ||
    String(row.payment_terms).trim() === "" ||
    row.lead_time_days === null ||
    row.lead_time_days === undefined
  ) {
    throw new Error(
      "Margin, payment terms, and lead time are required before submitting.",
    );
  }
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

  assertQuotationReadyForApproval(quotation);

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

export async function listPendingApprovalsForCurrentUser(): Promise<
  PendingApprovalItem[]
> {
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
    .select(
      "id, quotation_id, approver_role, status, quotations:quotation_id(quotation_number, subject, amount, cost, margin_amount, sector, google_drive_link, notes, created_at, clients:client_id(company_name), preparer:prepared_by(full_name, email))",
    )
    .eq("approver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load pending approvals.");
  }

  return (data ?? []).map((row) => {
    const quotation = Array.isArray(row.quotations) ? row.quotations[0] : row.quotations;
    const client = quotation
      ? Array.isArray(quotation.clients)
        ? quotation.clients[0]
        : quotation.clients
      : null;
    const preparer = quotation
      ? Array.isArray(quotation.preparer)
        ? quotation.preparer[0]
        : quotation.preparer
      : null;

    return {
      approvalId: row.id,
      quotationId: row.quotation_id,
      quotationNumber: quotation?.quotation_number ?? "",
      subject: quotation?.subject ?? "",
      amount: Number(quotation?.amount ?? 0),
      approverRole: row.approver_role,
      status: row.status,
      clientName: client?.company_name ?? undefined,
      cost:
        quotation?.cost === null || quotation?.cost === undefined
          ? null
          : Number(quotation.cost),
      marginAmount:
        quotation?.margin_amount === null || quotation?.margin_amount === undefined
          ? null
          : Number(quotation.margin_amount),
      sector: quotation?.sector ?? null,
      googleDriveLink: quotation?.google_drive_link ?? null,
      notes: quotation?.notes ?? null,
      createdAt: quotation?.created_at ?? undefined,
      preparedByName: resolveDisplayName(preparer) ?? undefined,
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

export async function resubmitQuotationForApproval(quotationId: string): Promise<void> {
  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("quotations")
    .select("id, status, amount, sales_margin_percent, payment_terms, lead_time_days")
    .eq("id", quotationId)
    .single();

  if (fetchError || !row) {
    throw new Error("Quotation not found.");
  }

  if (row.status !== "rejected") {
    throw new Error("Only rejected quotations can be resubmitted.");
  }

  assertQuotationReadyForApproval(row);

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      status: "pending",
      rejection_reason: null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to resubmit quotation.");
  }

  // Clear previous approval rows and create a fresh cycle.
  await supabase.from("quotation_approvals").delete().eq("quotation_id", quotationId);

  const roles = requiredApproverRolesForAmount(Number(row.amount));
  const rows: Array<{
    quotation_id: string;
    approver_id: string;
    approver_role: RequiredApproverRole;
    status: "pending";
  }> = [];

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

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("quotation_approvals")
      .insert(rows);
    if (insertError) {
      throw new Error(insertError.message || "Failed to create approval assignments.");
    }
  }
}
