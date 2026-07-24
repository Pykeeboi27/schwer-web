import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export type CostingApprovalLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
};

export type CostingApprovalItem = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  subject: string;
  amount: number;
  cost: number | null;
  items: CostingApprovalLineItem[];
  googleDriveLink: string | null;
  preparedByName: string;
  notes: string | null;
  createdAt: string;
};

export type CostingApprovalHistoryItem = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  subject: string;
  amount: number;
  cost: number | null;
  decision: "approved" | "rejected";
  rejectionReason: string | null;
  resolvedAt: string;
  preparedByName: string;
};

export async function listPendingCostingApprovals(): Promise<CostingApprovalItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, subject, amount, cost, google_drive_link, notes, created_at, clients:client_id(company_name), preparer:prepared_by(full_name, email), quotation_items(id, description, quantity, unit_cost, line_total, sort_order)",
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
      preparedByName: preparer?.full_name || preparer?.email || "Unknown",
      notes: row.notes,
      createdAt: row.created_at,
    };
  });
}

// Uses getCurrentProfile() (local JWT claims verification, no network
// round-trip to the auth server) instead of a fresh auth.getUser() + profile
// SELECT — see the comment on ensureCurrentProfile() for why getUser() is
// avoided on hot paths.
async function assertExecutiveActor(): Promise<{ id: string }> {
  const profile = await getCurrentProfile();

  if (
    !profile ||
    !profile.isActive ||
    profile.department !== "executive" ||
    profile.role !== "executive"
  ) {
    throw new Error("Only the Executive role can act on costing approvals.");
  }

  return { id: profile.id };
}

export async function approveCostingQuotation(quotationId: string): Promise<void> {
  await assertExecutiveActor();
  const supabase = await createClient();

  // The guard (phase/status) is folded into the UPDATE's WHERE clause rather
  // than a separate SELECT-then-UPDATE, saving a round-trip: a null result
  // means either not found or not in the required state.
  const { data, error: updateError } = await supabase
    .from("quotations")
    .update({
      phase: "sales",
      status: "draft",
      costing_rejection_reason: null,
      costing_rejected_by: null,
      costing_approved_at: new Date().toISOString(),
    })
    .eq("id", quotationId)
    .eq("phase", "costing")
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message || "Failed to approve costing quotation.");
  }

  if (!data) {
    throw new Error("Only quotations pending costing approval can be approved here.");
  }
}

export async function rejectCostingQuotation(input: {
  quotationId: string;
  reason: string;
}): Promise<void> {
  if (!input.reason.trim()) {
    throw new Error("Rejection reason is required.");
  }

  const actor = await assertExecutiveActor();
  const supabase = await createClient();

  const { data, error: updateError } = await supabase
    .from("quotations")
    .update({
      status: "draft",
      costing_rejection_reason: input.reason.trim(),
      costing_rejected_by: actor.id,
    })
    .eq("id", input.quotationId)
    .eq("phase", "costing")
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message || "Failed to reject costing quotation.");
  }

  if (!data) {
    throw new Error("Only quotations pending costing approval can be rejected here.");
  }
}

export async function deleteCostingQuotation(quotationId: string): Promise<void> {
  await assertExecutiveActor();
  const supabase = await createClient();

  const { data, error: deleteError } = await supabase
    .from("quotations")
    .delete()
    .eq("id", quotationId)
    .eq("phase", "costing")
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete costing quotation.");
  }

  if (!data) {
    throw new Error("Only quotations pending costing approval can be deleted here.");
  }
}

export async function listCostingApprovalHistory(): Promise<
  CostingApprovalHistoryItem[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, quotation_number, subject, amount, cost, costing_rejection_reason, costing_approved_at, updated_at, clients:client_id(company_name), preparer:prepared_by(full_name, email)",
    )
    .or(
      "costing_approved_at.not.is.null,and(phase.eq.costing,status.eq.draft,costing_rejection_reason.not.is.null)",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load costing approval history.");
  }

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const preparer = Array.isArray(row.preparer) ? row.preparer[0] : row.preparer;
    const isApproved = row.costing_approved_at !== null;
    return {
      quotationId: row.id,
      quotationNumber: row.quotation_number,
      clientName: client?.company_name ?? "Unknown client",
      subject: row.subject,
      amount: Number(row.amount),
      cost: row.cost === null ? null : Number(row.cost),
      decision: isApproved ? "approved" : "rejected",
      rejectionReason: row.costing_rejection_reason,
      resolvedAt: row.costing_approved_at ?? row.updated_at,
      preparedByName: preparer?.full_name || preparer?.email || "Unknown",
    };
  });
}
