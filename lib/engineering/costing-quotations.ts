import { createClient } from "@/lib/supabase/server";

export type CostingQuotationItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
};

export type CostingApprovedHistoryItem = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  subject: string;
  amount: number;
  cost: number | null;
  items: CostingQuotationItem[];
  googleDriveLink: string | null;
  notes: string | null;
  salesPersonId: string | null;
  salesPersonName: string | null;
  createdAt: string;
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
  items: CostingQuotationItem[];
  googleDriveLink: string | null;
  notes: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled";
  costingRejectionReason: string | null;
  preparedBy: string;
  salesPersonId: string | null;
  salesPersonName: string | null;
  createdAt: string;
};

export { suggestQuotationNumber } from "@/lib/engineering/suggest-quotation-number";

export function parseCostingAmount(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Quotation amount must be greater than 0.");
  }
  return value;
}

export function parseUnitCost(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Unit cost must be 0 or greater.");
  }
  return value;
}

/** True once every line item on the quotation has a unit cost set. */
export function allItemsCosted(items: Array<{ unitCost: number | null }>): boolean {
  return items.length > 0 && items.every((item) => item.unitCost !== null);
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
      "id, quotation_number, client_id, subject, amount, cost, google_drive_link, costing_rejection_reason, notes, status, prepared_by, sales_person_id, created_at, clients:client_id(company_name), sales_person:sales_person_id(full_name, email), quotation_items(id, description, quantity, unit_cost, line_total, sort_order)",
    )
    .eq("phase", "costing")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load costing quotations.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const salesPerson = Array.isArray(row.sales_person)
      ? row.sales_person[0]
      : row.sales_person;
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
      costingRejectionReason: row.costing_rejection_reason,
      preparedBy: row.prepared_by,
      salesPersonId: row.sales_person_id,
      salesPersonName: salesPerson?.full_name || salesPerson?.email || null,
      createdAt: row.created_at,
    };
  });
}

export async function listCostingApprovedHistory(): Promise<
  CostingApprovedHistoryItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, subject, amount, cost, google_drive_link, notes, sales_person_id, created_at, costing_approved_at, clients:client_id(company_name), sales_person:sales_person_id(full_name, email), quotation_items(id, description, quantity, unit_cost, line_total, sort_order)",
    )
    .not("costing_approved_at", "is", null)
    .order("costing_approved_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load costing approval history.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const salesPerson = Array.isArray(row.sales_person)
      ? row.sales_person[0]
      : row.sales_person;
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
      quotationId: row.id,
      quotationNumber: row.quotation_number,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      amount: Number(row.amount),
      cost: row.cost === null ? null : Number(row.cost),
      items,
      googleDriveLink: row.google_drive_link,
      notes: row.notes,
      salesPersonId: row.sales_person_id,
      salesPersonName: salesPerson?.full_name || salesPerson?.email || null,
      createdAt: row.created_at,
      approvedAt: row.costing_approved_at,
    };
  });
}

/**
 * Engineering sets/updates the per-item unit cost on a Sales-originated
 * request for quotation, plus the Google Drive link and optional metadata
 * corrections. quotations.cost rolls up automatically via the
 * trg_sync_quotation_cost_from_items trigger.
 */
export async function setQuotationItemCosts(input: {
  quotationId: string;
  quotationNumber?: string;
  clientId: string;
  subject: string;
  items: Array<{ id: string; unitCost: number | null }>;
  googleDriveLink: string;
  notes?: string | null;
  salesPersonId?: string | null;
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
    .select("id, status, phase")
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

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("sector")
    .eq("id", input.clientId)
    .single();

  if (clientError || !clientRow) {
    throw new Error("Selected client was not found.");
  }

  const updatePayload: Record<string, unknown> = {
    client_id: input.clientId,
    sector: clientRow.sector,
    subject: input.subject,
    google_drive_link: input.googleDriveLink,
    notes: input.notes ?? null,
    sales_person_id: input.salesPersonId ?? null,
    costing_rejection_reason: null,
  };

  if (input.quotationNumber) {
    updatePayload.quotation_number = input.quotationNumber;
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update(updatePayload)
    .eq("id", input.quotationId);

  if (updateError) {
    if (updateError.code === "23505") {
      throw new Error("Quotation ID already exists. Please choose a different one.");
    }
    throw new Error(updateError.message || "Failed to update costing quotation.");
  }

  for (const item of input.items) {
    const { error: itemError } = await supabase
      .from("quotation_items")
      .update({ unit_cost: item.unitCost })
      .eq("id", item.id)
      .eq("quotation_id", input.quotationId);

    if (itemError) {
      throw new Error(itemError.message || "Failed to update an item's unit cost.");
    }
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
    .select("id, status, phase")
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

  const { error: deleteError } = await supabase
    .from("quotations")
    .delete()
    .eq("id", quotationId);

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
    .select(
      "id, status, phase, google_drive_link, sales_person_id, quotation_items(unit_cost)",
    )
    .eq("id", quotationId)
    .single();

  if (rowError || !row) {
    throw new Error("Quotation was not found.");
  }

  if (row.phase !== "costing") {
    throw new Error(
      "Only costing-phase quotations can be submitted for costing approval.",
    );
  }

  if (row.status !== "draft") {
    throw new Error("Only draft costing quotations can be submitted.");
  }

  const items = Array.isArray(row.quotation_items) ? row.quotation_items : [];
  if (
    !allItemsCosted(
      items.map((item) => ({
        unitCost: item.unit_cost === null ? null : Number(item.unit_cost),
      })),
    )
  ) {
    throw new Error(
      "Every line item needs a unit cost before submitting for costing approval.",
    );
  }

  if (!row.google_drive_link) {
    throw new Error(
      "A Google Drive link is required before submitting for costing approval.",
    );
  }

  if (!row.sales_person_id) {
    throw new Error(
      "A sales person must be assigned before submitting for costing approval.",
    );
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({ status: "pending", costing_rejection_reason: null })
    .eq("id", quotationId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to submit costing quotation.");
  }
}
