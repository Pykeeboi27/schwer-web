import { createClient } from "@/lib/supabase/server";

export type CostingApprovedHistoryItem = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  subject: string;
  amount: number;
  cost: number | null;
  googleDriveLink: string | null;
  approvedAt: string;
};

export type CostingQuotation = {
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
  costingRejectionReason: string | null;
  preparedBy: string;
  createdAt: string;
};

export function parseCostingAmount(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Quotation amount must be greater than 0.");
  }
  return value;
}

export function parseCostingCost(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Cost must be 0 or greater.");
  }
  return value;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function listCostingQuotations(): Promise<CostingQuotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, client_id, subject, amount, cost, google_drive_link, costing_rejection_reason, notes, status, prepared_by, created_at, clients:client_id(company_name)",
    )
    .eq("phase", "costing")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load costing quotations.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
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
      costingRejectionReason: row.costing_rejection_reason,
      preparedBy: row.prepared_by,
      createdAt: row.created_at,
    };
  });
}

export async function listCostingApprovedHistory(): Promise<CostingApprovedHistoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, subject, amount, cost, google_drive_link, costing_approved_at, clients:client_id(company_name)",
    )
    .not("costing_approved_at", "is", null)
    .order("costing_approved_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load costing approval history.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      quotationId: row.id,
      quotationNumber: row.quotation_number,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      amount: Number(row.amount),
      cost: row.cost === null ? null : Number(row.cost),
      googleDriveLink: row.google_drive_link,
      approvedAt: row.costing_approved_at,
    };
  });
}

export async function createCostingQuotation(input: {
  clientId: string;
  subject: string;
  amount: number;
  cost: number;
  googleDriveLink: string;
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
      cost: input.cost,
      google_drive_link: input.googleDriveLink,
      notes: input.notes ?? null,
      prepared_by: user.id,
      status: "draft",
      phase: "costing",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create costing quotation.");
  }

  return { quotationId: data.id };
}

export async function updateCostingQuotation(input: {
  quotationId: string;
  clientId: string;
  subject: string;
  amount: number;
  cost: number;
  googleDriveLink: string;
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

  const { data: row, error: rowError } = await supabase
    .from("quotations")
    .select("id, status, phase, prepared_by")
    .eq("id", input.quotationId)
    .single();

  if (rowError || !row) {
    throw new Error("Quotation was not found.");
  }

  if (row.phase !== "costing") {
    throw new Error("Only costing-phase quotations can be edited here.");
  }

  if (row.status !== "draft") {
    throw new Error("Only draft costing quotations can be edited.");
  }

  if (row.prepared_by !== user.id) {
    throw new Error("Only the costing engineer who created this quotation can edit it.");
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
      cost: input.cost,
      google_drive_link: input.googleDriveLink,
      notes: input.notes ?? null,
      costing_rejection_reason: null,
    })
    .eq("id", input.quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update costing quotation.");
  }
}

export async function deleteCostingQuotation(quotationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: row, error: rowError } = await supabase
    .from("quotations")
    .select("id, status, phase, prepared_by")
    .eq("id", quotationId)
    .single();

  if (rowError || !row) {
    throw new Error("Quotation was not found.");
  }

  if (row.phase !== "costing") {
    throw new Error("Only costing-phase quotations can be deleted here.");
  }

  if (row.status !== "draft") {
    throw new Error("Only draft costing quotations can be deleted.");
  }

  if (row.prepared_by !== user.id) {
    throw new Error("Only the costing engineer who created this quotation can delete it.");
  }

  const { error: deleteError } = await supabase.from("quotations").delete().eq("id", quotationId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete costing quotation.");
  }
}

export async function submitCostingForApproval(quotationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: row, error: rowError } = await supabase
    .from("quotations")
    .select("id, status, phase, prepared_by, google_drive_link, cost")
    .eq("id", quotationId)
    .single();

  if (rowError || !row) {
    throw new Error("Quotation was not found.");
  }

  if (row.phase !== "costing") {
    throw new Error("Only costing-phase quotations can be submitted for costing approval.");
  }

  if (row.status !== "draft") {
    throw new Error("Only draft costing quotations can be submitted.");
  }

  if (row.prepared_by !== user.id) {
    throw new Error("Only the costing engineer who created this quotation can submit it.");
  }

  if (row.cost === null || row.cost === undefined) {
    throw new Error("Cost must be set before submitting for costing approval.");
  }

  if (!row.google_drive_link) {
    throw new Error("A Google Drive link is required before submitting for costing approval.");
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({ status: "pending", costing_rejection_reason: null })
    .eq("id", quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to submit costing quotation.");
  }
}
