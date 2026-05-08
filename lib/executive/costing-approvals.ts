import { createClient } from "@/lib/supabase/server";

export type CostingApprovalItem = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  subject: string;
  amount: number;
  cost: number | null;
  googleDriveLink: string | null;
  preparedByName: string;
  notes: string | null;
  createdAt: string;
};

export async function listPendingCostingApprovals(): Promise<CostingApprovalItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, subject, amount, cost, google_drive_link, notes, created_at, clients:client_id(company_name), preparer:prepared_by(full_name, email)",
    )
    .eq("phase", "costing")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load pending costing approvals.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const preparer = Array.isArray(row.preparer) ? row.preparer[0] : row.preparer;
    return {
      quotationId: row.id,
      quotationNumber: row.quotation_number,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      amount: Number(row.amount),
      cost: row.cost === null ? null : Number(row.cost),
      googleDriveLink: row.google_drive_link,
      preparedByName: preparer?.full_name || preparer?.email || "Unknown",
      notes: row.notes,
      createdAt: row.created_at,
    };
  });
}

async function assertExecutiveActor(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("department, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Profile not found.");
  }

  if (
    !profile.is_active ||
    profile.department !== "executive" ||
    profile.role !== "executive"
  ) {
    throw new Error("Only the Executive role can act on costing approvals.");
  }
}

export async function approveCostingQuotation(quotationId: string): Promise<void> {
  await assertExecutiveActor();
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("quotations")
    .select("id, phase, status")
    .eq("id", quotationId)
    .single();

  if (rowError || !row) {
    throw new Error("Quotation was not found.");
  }

  if (row.phase !== "costing" || row.status !== "pending") {
    throw new Error("Only quotations pending costing approval can be approved here.");
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      phase: "sales",
      status: "draft",
      costing_rejection_reason: null,
    })
    .eq("id", quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to approve costing quotation.");
  }
}

export async function rejectCostingQuotation(input: {
  quotationId: string;
  reason: string;
}): Promise<void> {
  if (!input.reason.trim()) {
    throw new Error("Rejection reason is required.");
  }

  await assertExecutiveActor();
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("quotations")
    .select("id, phase, status")
    .eq("id", input.quotationId)
    .single();

  if (rowError || !row) {
    throw new Error("Quotation was not found.");
  }

  if (row.phase !== "costing" || row.status !== "pending") {
    throw new Error("Only quotations pending costing approval can be rejected here.");
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      status: "draft",
      costing_rejection_reason: input.reason.trim(),
    })
    .eq("id", input.quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to reject costing quotation.");
  }
}
