import { isTargetEditor } from "@/lib/executive/access";
import { executiveDashboardQueries } from "@/lib/executive/dashboard";
import { getPeriodDateRange } from "@/lib/executive/period";
import type { PeriodFilter } from "@/lib/executive/types";
import {
  getCurrentProfile,
  type CurrentProfile,
} from "@/lib/profile/get-current-profile";
import {
  attributeBookedRevenue,
  fetchBookedPoRows,
  sumBookedRevenue,
  UNATTRIBUTED_OWNER_ID,
} from "@/lib/sales/booked-revenue";
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

/**
 * YTD booked-PO totals keyed by attributed salesperson profile id, plus the
 * true company-wide total (matching Revenue YTD (Booked) / Total PO Value /
 * Closed Sales) and the portion of it that couldn't be attributed to anyone
 * on the active sales roster.
 */
export async function getYtdPoBySalesPerson(referenceDate = new Date()): Promise<{
  bySalesPerson: Map<string, number>;
  totalAchieved: number;
  unattributedAchieved: number;
}> {
  const ytdRange = getPeriodDateRange("ytd", referenceDate);
  const rows = await fetchBookedPoRows(ytdRange.startDate, ytdRange.endDate);
  const bySalesPerson = attributeBookedRevenue(rows);

  return {
    bySalesPerson,
    totalAchieved: sumBookedRevenue(rows),
    unattributedAchieved: bySalesPerson.get(UNATTRIBUTED_OWNER_ID) ?? 0,
  };
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

export type SalesQuotaProgressResult = {
  entries: SalesQuotaProgress[];
  /** Sum of every entry's `achieved` plus `unattributedAchieved` -- always equals
   *  the company-wide booked-revenue total (Revenue YTD (Booked) / Total PO
   *  Value / Closed Sales), so this card can never read differently from those. */
  totalAchieved: number;
  /** Portion of totalAchieved attributed to a PO with no active-roster salesperson
   *  (a deactivated user, a coordinator, or no owner at all) -- previously dropped
   *  silently; now surfaced so the entries + this value reconcile to totalAchieved. */
  unattributedAchieved: number;
};

/** Quota + achieved-vs-quota progress for every active salesperson, for the executive Quotas tab. */
export async function getSalesQuotaProgress(
  year: number,
  options: { viewer?: CurrentProfile | null; referenceDate?: Date } = {},
): Promise<SalesQuotaProgressResult> {
  if (options.viewer !== undefined && !isTargetEditor(options.viewer)) {
    throw new Error("Unauthorized sales quota access.");
  }

  const [roster, quotas, ytd] = await Promise.all([
    getSalesRoster(),
    getSalesQuotas(year),
    getYtdPoBySalesPerson(options.referenceDate),
  ]);

  const entries = roster
    .map((entry) => {
      const quotaAmount = quotas.get(entry.profileId) ?? null;
      const achieved = ytd.bySalesPerson.get(entry.profileId) ?? 0;

      return {
        profileId: entry.profileId,
        name: entry.name,
        quotaAmount,
        achieved,
        percent: computeQuotaPercent(achieved, quotaAmount),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    entries,
    totalAchieved: ytd.totalAchieved,
    unattributedAchieved: ytd.unattributedAchieved,
  };
}

/** Single-person quota progress, for the sales dashboard's "My quota" card. */
export async function getMyQuotaProgress(
  profileId: string,
  year: number,
): Promise<SalesQuotaProgress> {
  const supabase = await createClient();
  const [{ data: quotaRow, error: quotaError }, ytd] = await Promise.all([
    supabase
      .from("sales_quotas")
      .select("quota_amount")
      .eq("profile_id", profileId)
      .eq("year", year)
      .maybeSingle(),
    getYtdPoBySalesPerson(),
  ]);

  if (quotaError) {
    throw new Error("Failed to load your sales quota.");
  }

  const quotaAmount = quotaRow ? toNumber(quotaRow.quota_amount) : null;
  const achieved = ytd.bySalesPerson.get(profileId) ?? 0;

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
