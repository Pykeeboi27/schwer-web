import { computeLandedUnitCost } from "@/lib/engineering/landed-cost";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export { computeLandedUnitCost } from "@/lib/engineering/landed-cost";

export type CostingQuotationItem = {
  id: string;
  description: string;
  quantity: number;
  rawCost: number | null;
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
  costingRejectedByName: string | null;
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

export function parseRawCost(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Raw cost must be 0 or greater.");
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
      "id, quotation_number, client_id, subject, amount, cost, google_drive_link, costing_rejection_reason, costing_rejected_by, notes, status, prepared_by, sales_person_id, created_at, clients:client_id(company_name), sales_person:sales_person_id(full_name, email), rejected_by:costing_rejected_by(full_name, email), quotation_items(id, description, quantity, raw_cost, unit_cost, line_total, sort_order)",
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
    const rejectedBy = Array.isArray(row.rejected_by)
      ? row.rejected_by[0]
      : row.rejected_by;
    const items = (Array.isArray(row.quotation_items) ? row.quotation_items : [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        rawCost: item.raw_cost === null ? null : Number(item.raw_cost),
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
      costingRejectedByName: rejectedBy?.full_name || rejectedBy?.email || null,
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
      "id, quotation_number, subject, amount, cost, google_drive_link, notes, sales_person_id, created_at, costing_approved_at, clients:client_id(company_name), sales_person:sales_person_id(full_name, email), quotation_items(id, description, quantity, raw_cost, unit_cost, line_total, sort_order)",
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
        rawCost: item.raw_cost === null ? null : Number(item.raw_cost),
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
 * Engineering sets/updates the per-item raw material+labor cost on a
 * Sales-originated request for quotation, plus the Google Drive link and
 * optional metadata corrections. The landed unit_cost (display figure) is
 * derived here via computeLandedUnitCost; the exact line_total itself is
 * computed by the DB directly from raw_cost (see migration 0024).
 * quotations.cost rolls up automatically via the
 * trg_sync_quotation_cost_from_items trigger.
 */
export async function setQuotationItemCosts(input: {
  quotationId: string;
  quotationNumber?: string;
  clientId: string;
  subject: string;
  items: Array<{ id: string; rawCost: number | null }>;
  googleDriveLink: string;
  notes?: string | null;
  salesPersonId?: string | null;
}): Promise<void> {
  // getCurrentProfile() verifies the session via local JWT claims, avoiding
  // the network round-trip that auth.getUser() makes to the auth server.
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
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

  const updatePayload: Record<string, unknown> = {
    client_id: input.clientId,
    sector: clientRow.sector,
    // Quotation subject and comments are standardized to ALL CAPS.
    subject: input.subject.toUpperCase(),
    google_drive_link: input.googleDriveLink,
    notes: input.notes ? input.notes.toUpperCase() : null,
    sales_person_id: input.salesPersonId ?? null,
    costing_rejection_reason: null,
    costing_rejected_by: null,
  };

  if (input.quotationNumber) {
    updatePayload.quotation_number = input.quotationNumber;
  }

  // The guard (phase='costing', status='draft') is folded into the UPDATE's
  // WHERE clause rather than a separate SELECT-then-UPDATE, saving a
  // round-trip: a null result means either not found or not editable.
  const { data: updatedRow, error: updateError } = await supabase
    .from("quotations")
    .update(updatePayload)
    .eq("id", input.quotationId)
    .eq("phase", "costing")
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23505") {
      throw new Error("Quotation ID already exists. Please choose a different one.");
    }
    throw new Error(updateError.message || "Failed to update costing quotation.");
  }

  if (!updatedRow) {
    throw new Error("Only draft costing quotations can be edited.");
  }

  // Fetched up front so the post-save notification can tell whether any cost
  // value actually changed (editing notes/drive-link alone shouldn't notify).
  const { data: existingItems, error: existingItemsError } = await supabase
    .from("quotation_items")
    .select("id, raw_cost")
    .eq("quotation_id", input.quotationId);

  if (existingItemsError) {
    throw new Error("Failed to load existing item costs.");
  }

  const previousRawCostById = new Map(
    (existingItems ?? []).map((row) => [row.id, row.raw_cost]),
  );

  // Sequential, not Promise.all: every quotation_items write fires
  // trg_sync_quotation_cost_from_items, which UPDATEs the shared parent
  // quotations row. Concurrent item writes for the same quotation all
  // contend for that same row's lock — Postgres serializes them regardless,
  // so running them concurrently buys nothing and risks a lock pile-up
  // (this caused a real `statement timeout` under load).
  let anyCostChanged = false;
  for (const item of input.items) {
    const unitCost = item.rawCost === null ? null : computeLandedUnitCost(item.rawCost);

    const { error: itemError } = await supabase
      .from("quotation_items")
      .update({ raw_cost: item.rawCost, unit_cost: unitCost })
      .eq("id", item.id)
      .eq("quotation_id", input.quotationId);

    if (itemError) {
      throw new Error(itemError.message || "Failed to update an item's unit cost.");
    }

    if ((previousRawCostById.get(item.id) ?? null) !== item.rawCost) {
      anyCostChanged = true;
    }
  }

  // Notify the sales person who created the RFQ that costing changed. Best
  // effort: the costing save itself already succeeded, so a notification
  // hiccup shouldn't fail the whole action. See migration 0015 for why this
  // is a single RPC call after the batch rather than a per-item trigger.
  if (anyCostChanged) {
    const { error: notifyError } = await supabase.rpc("fn_notify_costing_cost_updated", {
      target_quotation_id: input.quotationId,
    });

    if (notifyError) {
      console.error("Failed to notify sales person of costing update:", notifyError);
    }
  }
}

export async function deleteCostingQuotation(quotationId: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();

  const { data, error: deleteError } = await supabase
    .from("quotations")
    .delete()
    .eq("id", quotationId)
    .eq("phase", "costing")
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete costing quotation.");
  }

  if (!data) {
    throw new Error("Only draft costing quotations can be deleted.");
  }
}

export async function submitCostingForApproval(quotationId: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = await createClient();

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

  const { data: updatedRow, error: updateError } = await supabase
    .from("quotations")
    .update({
      status: "pending",
      costing_rejection_reason: null,
      costing_rejected_by: null,
    })
    .eq("id", quotationId)
    .eq("phase", "costing")
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message || "Failed to submit costing quotation.");
  }

  if (!updatedRow) {
    throw new Error("Only draft costing quotations can be submitted.");
  }
}
