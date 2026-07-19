import { isTargetEditor } from "@/lib/executive/access";
import { executiveDashboardQueries } from "@/lib/executive/dashboard";
import { getPeriodDateRange } from "@/lib/executive/period";
import type { PeriodFilter } from "@/lib/executive/types";
import {
  getCurrentProfile,
  type CurrentProfile,
} from "@/lib/profile/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export type SalesQuotaRosterEntry = {
  profileId: string;
  name: string;
};

export type SalesQuotaProgress = {
  profileId: string;
  name: string;
  quotaAmount: number | null;
  achieved: number;
  /** achieved / quotaAmount * 100, unclamped (can exceed 100). Null when no quota is set. */
  percent: number | null;
};

type ApprovedPoRow = {
  po_amount: number | string | null;
  created_by: string | null;
  quotation_id: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function validateQuotaAmountInput(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Annual quota must be a non-negative number.");
  }

  return Number(value);
}

/** Active sales-department roster, adapted from the executive dashboard's roster query. */
export async function getSalesRoster(): Promise<SalesQuotaRosterEntry[]> {
  const roster = await executiveDashboardQueries.fetchSalesRoster();
  return roster.map((entry) => ({ profileId: entry.ownerId, name: entry.ownerName }));
}

type ApprovedPoWithQuotationOwnerRow = {
  po_amount: number | string | null;
  created_by: string | null;
  quotation_id: string | null;
  quotations:
    { sales_person_id: string | null } | { sales_person_id: string | null }[] | null;
};

/**
 * Fetches approved POs together with their linked quotation's
 * `sales_person_id` via an embedded join, instead of a separate follow-up
 * query resolving each distinct `quotation_id` — one round-trip instead of two.
 */
async function fetchApprovedPurchaseOrdersWithQuotationOwner(
  startDate: string,
  endDate: string,
): Promise<ApprovedPoWithQuotationOwnerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "po_amount, created_by, quotation_id, quotations:quotation_id(sales_person_id)",
    )
    .eq("status", "approved")
    .gte("approved_at", startDate)
    .lte("approved_at", `${endDate}T23:59:59.999Z`);

  if (error) {
    throw new Error("Failed to load purchase orders for quota progress.");
  }

  return (data ?? []) as ApprovedPoWithQuotationOwnerRow[];
}

/**
 * Attributes each approved PO to a salesperson: the linked quotation's
 * `sales_person_id` when one exists, falling back to the PO's own
 * `created_by` for manually created POs with no linked quotation (or whose
 * quotation has no assigned salesperson).
 */
export function attributePurchaseOrdersToSalesPerson(
  rows: ApprovedPoRow[],
  quotationSalesPersonMap: Map<string, string | null>,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const quotationOwner = row.quotation_id
      ? quotationSalesPersonMap.get(row.quotation_id)
      : null;
    const ownerId = quotationOwner ?? row.created_by;

    if (!ownerId) {
      continue;
    }

    totals.set(ownerId, (totals.get(ownerId) ?? 0) + toNumber(row.po_amount));
  }

  return totals;
}

/** Approved-PO totals for the given year, keyed by attributed salesperson profile id. */
export async function getAnnualPoBySalesPerson(
  year: number,
): Promise<Map<string, number>> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const rawRows = await fetchApprovedPurchaseOrdersWithQuotationOwner(startDate, endDate);

  const rows: ApprovedPoRow[] = rawRows.map((row) => ({
    po_amount: row.po_amount,
    created_by: row.created_by,
    quotation_id: row.quotation_id,
  }));

  const quotationSalesPersonMap = new Map<string, string | null>();
  for (const row of rawRows) {
    if (!row.quotation_id) continue;
    const quotation = Array.isArray(row.quotations) ? row.quotations[0] : row.quotations;
    quotationSalesPersonMap.set(row.quotation_id, quotation?.sales_person_id ?? null);
  }

  return attributePurchaseOrdersToSalesPerson(rows, quotationSalesPersonMap);
}

/** Quotas set for the given year, keyed by profile id. */
export async function getSalesQuotas(year: number): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_quotas")
    .select("profile_id, quota_amount")
    .eq("year", year);

  if (error) {
    throw new Error("Failed to load sales quotas.");
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(String(row.profile_id), toNumber(row.quota_amount));
  }

  return map;
}

export function computeQuotaPercent(
  achieved: number,
  quotaAmount: number | null,
): number | null {
  if (quotaAmount === null || quotaAmount <= 0) {
    return null;
  }

  return (achieved / quotaAmount) * 100;
}

/** Sets/updates one salesperson's quota for a year. Callers must already have checked `isTargetEditor`. */
export async function upsertSalesQuota(
  profileId: string,
  year: number,
  quotaAmountInput: number,
): Promise<void> {
  const quotaAmount = validateQuotaAmountInput(quotaAmountInput);

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in to update sales quotas.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sales_quotas").upsert(
    {
      profile_id: profileId,
      year,
      quota_amount: quotaAmount,
      set_by: profile.id,
    },
    { onConflict: "profile_id,year" },
  );

  if (error) {
    throw new Error("Failed to update sales quota.");
  }
}

/** Quota + achieved-vs-quota progress for every active salesperson, for the executive Quotas tab. */
export async function getSalesQuotaProgress(
  year: number,
  options: { viewer?: CurrentProfile | null } = {},
): Promise<SalesQuotaProgress[]> {
  if (options.viewer !== undefined && !isTargetEditor(options.viewer)) {
    throw new Error("Unauthorized sales quota access.");
  }

  const [roster, quotas, achievedMap] = await Promise.all([
    getSalesRoster(),
    getSalesQuotas(year),
    getAnnualPoBySalesPerson(year),
  ]);

  return roster
    .map((entry) => {
      const quotaAmount = quotas.get(entry.profileId) ?? null;
      const achieved = achievedMap.get(entry.profileId) ?? 0;

      return {
        profileId: entry.profileId,
        name: entry.name,
        quotaAmount,
        achieved,
        percent: computeQuotaPercent(achieved, quotaAmount),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Single-person quota progress, for the sales dashboard's "My quota" card. */
export async function getMyQuotaProgress(
  profileId: string,
  year: number,
): Promise<SalesQuotaProgress> {
  const supabase = await createClient();
  const [{ data: quotaRow, error: quotaError }, achievedMap] = await Promise.all([
    supabase
      .from("sales_quotas")
      .select("quota_amount")
      .eq("profile_id", profileId)
      .eq("year", year)
      .maybeSingle(),
    getAnnualPoBySalesPerson(year),
  ]);

  if (quotaError) {
    throw new Error("Failed to load your sales quota.");
  }

  const quotaAmount = quotaRow ? toNumber(quotaRow.quota_amount) : null;
  const achieved = achievedMap.get(profileId) ?? 0;

  return {
    profileId,
    name: "",
    quotaAmount,
    achieved,
    percent: computeQuotaPercent(achieved, quotaAmount),
  };
}

type CostingVelocityRow = {
  costing_approved_at: string | null;
  po_converted_at: string | null;
};

async function fetchCostingVelocityRows(
  startDate: string,
  endDate: string,
): Promise<CostingVelocityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("costing_approved_at, po_converted_at")
    .not("costing_approved_at", "is", null)
    .not("po_converted_at", "is", null)
    .gte("po_converted_at", startDate)
    .lte("po_converted_at", `${endDate}T23:59:59.999Z`);

  if (error) {
    throw new Error("Failed to load quotation costing velocity.");
  }

  return (data ?? []) as CostingVelocityRow[];
}

/** Average number of days between costing approval and PO conversion, across the given rows. */
export function buildAverageCostingToPoDaysFromRows(
  rows: CostingVelocityRow[],
): number | null {
  if (rows.length === 0) {
    return null;
  }

  const totalDays = rows.reduce((sum, row) => {
    const start = new Date(row.costing_approved_at as string).getTime();
    const end = new Date(row.po_converted_at as string).getTime();
    return sum + (end - start) / (1000 * 60 * 60 * 24);
  }, 0);

  return totalDays / rows.length;
}

/** Avg. days from costing approval to PO conversion, for quotations converted within the period. */
export async function getAverageCostingToPoDays(
  periodFilter: PeriodFilter,
  referenceDate = new Date(),
): Promise<number | null> {
  const range = getPeriodDateRange(periodFilter, referenceDate);
  const rows = await fetchCostingVelocityRows(range.startDate, range.endDate);
  return buildAverageCostingToPoDaysFromRows(rows);
}
