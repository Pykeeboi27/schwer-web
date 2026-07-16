import { cache } from "react";

import { isExecutiveDashboardViewer } from "@/lib/executive/access";
import {
  buildMonthBuckets,
  buildQuarterBuckets,
  buildWeekBuckets,
  getCurrentYear,
  getPeriodDateRange,
  getQuarterFromMonth,
  getWeekOfMonth,
} from "@/lib/executive/period";
import type {
  ExecutiveDashboardData,
  ExecutiveKpiSummary,
  ExecutivePoSummary,
  ExecutiveRevenueBreakdown,
  ExecutiveSalesPerformanceRow,
  PeriodFilter,
  WeeklyRevenuePoint,
} from "@/lib/executive/types";
import type { CurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesDashboardCharts } from "@/lib/sales/dashboard-charts";
import { getQuarterlyTargets } from "@/lib/executive/targets";
import { createClient } from "@/lib/supabase/server";

export type SalesRosterEntry = {
  ownerId: string;
  ownerName: string;
};

export type PurchaseOrderMetricRow = {
  po_amount: number | string | null;
  margin_amount: number | string | null;
  po_date: string | null;
  created_by?: string | null;
};

type PurchaseOrderRange = {
  startDate: string;
  endDate: string;
};

export type ExecutiveDashboardQueryOptions = {
  viewer?: CurrentProfile | null;
  referenceDate?: Date;
  /** Month (1-12) to bucket the Monthly-view weekly revenue breakdown by. */
  breakdownMonth?: number;
};

export const EMPTY_EXECUTIVE_KPIS: ExecutiveKpiSummary = {
  revenueYtdBooked: 0,
  annualTarget: null,
  quarterlyTargets: { q1: null, q2: null, q3: null, q4: null },
  revenueVsTargetDelta: null,
  marginYtdWeightedPercent: null,
};

export const EMPTY_EXECUTIVE_PO_SUMMARY: ExecutivePoSummary = {
  poCount: 0,
  totalPoValue: 0,
  totalMarginAmount: 0,
};

export const EMPTY_EXECUTIVE_REVENUE_BREAKDOWN: ExecutiveRevenueBreakdown = {
  monthlyRevenue: [],
  quarterlyRevenue: [],
  ytdRevenueByMonth: [],
  weeklyRevenue: [],
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

function getMonthFromPoDate(dateValue: string | null): number | null {
  if (!dateValue || dateValue.length < 7) {
    return null;
  }

  const month = Number(dateValue.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return month;
}

function getDayFromPoDate(dateValue: string | null): number | null {
  if (!dateValue || dateValue.length < 10) {
    return null;
  }

  const day = Number(dateValue.slice(8, 10));
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }

  return day;
}

// Request-scoped memoization keyed on the primitive date bounds. The executive
// dashboard requests the same YTD range from several branches (KPI, revenue
// breakdown, PO summary, sales performance); keying on strings — rather than the
// fresh range object each caller passes — lets `cache()` dedupe them into a
// single `purchase_orders` scan per distinct range.
const fetchPurchaseOrderRowsCached = cache(
  async (startDate: string, endDate: string): Promise<PurchaseOrderMetricRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("po_amount, margin_amount, po_date:approved_at, created_by")
      .eq("status", "approved")
      .gte("approved_at", startDate)
      .lte("approved_at", `${endDate}T23:59:59.999Z`);

    if (error) {
      throw new Error("Failed to load executive dashboard purchase orders.");
    }

    return (data ?? []) as PurchaseOrderMetricRow[];
  },
);

export const executiveDashboardQueries = {
  fetchPurchaseOrderRows(range: PurchaseOrderRange): Promise<PurchaseOrderMetricRow[]> {
    return fetchPurchaseOrderRowsCached(range.startDate, range.endDate);
  },

  async fetchAnnualTarget(year: number): Promise<number | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("revenue_targets")
      .select("target_amount")
      .eq("year", year)
      .is("month", null)
      .is("sector", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error("Failed to load executive annual target.");
    }

    if (!data) {
      return null;
    }

    return toNumber(data.target_amount);
  },

  /** Active sales-department roster, so everyone appears even with no POs yet. */
  async fetchSalesRoster(): Promise<SalesRosterEntry[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("department", "sales")
      .eq("is_active", true);

    if (error) {
      return [];
    }

    const roster: SalesRosterEntry[] = [];

    for (const row of data ?? []) {
      const id = String(row.id ?? "");
      const email = String(row.email ?? "").trim();
      if (!id || !email) {
        continue;
      }

      roster.push({ ownerId: id, ownerName: email.split("@")[0] });
    }

    return roster;
  },

  /** Email-username fallback for owner ids not covered by the sales roster (e.g. a manager). */
  async fetchProfileUsernames(profileIds: string[]): Promise<Map<string, string>> {
    if (profileIds.length === 0) {
      return new Map();
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", profileIds);

    if (error) {
      return new Map();
    }

    const usernameMap = new Map<string, string>();

    for (const row of data ?? []) {
      const id = String(row.id ?? "");
      if (!id) {
        continue;
      }

      const email = String(row.email ?? "").trim();
      if (email) {
        usernameMap.set(id, email.split("@")[0]);
      }
    }

    return usernameMap;
  },
};

export function summarizeRevenueAndMargin(rows: PurchaseOrderMetricRow[]): {
  bookedRevenue: number;
  marginAmount: number;
  weightedMarginPercent: number | null;
} {
  const bookedRevenue = rows.reduce((sum, row) => sum + toNumber(row.po_amount), 0);
  const marginAmount = rows.reduce((sum, row) => sum + toNumber(row.margin_amount), 0);
  const weightedMarginPercent =
    bookedRevenue > 0 ? (marginAmount / bookedRevenue) * 100 : null;

  return {
    bookedRevenue,
    marginAmount,
    weightedMarginPercent,
  };
}

export function buildKpiSummaryFromRows(
  rows: PurchaseOrderMetricRow[],
  annualTarget: number | null,
  quarterlyTargets?: {
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
  },
): ExecutiveKpiSummary {
  const totals = summarizeRevenueAndMargin(rows);

  return {
    revenueYtdBooked: totals.bookedRevenue,
    annualTarget,
    quarterlyTargets: quarterlyTargets ?? { q1: null, q2: null, q3: null, q4: null },
    revenueVsTargetDelta:
      annualTarget === null ? null : totals.bookedRevenue - annualTarget,
    marginYtdWeightedPercent: totals.weightedMarginPercent,
  };
}

export function buildRevenueBreakdownFromRows(
  rowsForYear: PurchaseOrderMetricRow[],
  rowsForYtd: PurchaseOrderMetricRow[],
  referenceDate: Date,
  targetMonth: number = referenceDate.getMonth() + 1,
): ExecutiveRevenueBreakdown {
  const currentYear = getCurrentYear(referenceDate);
  const currentMonth = targetMonth;

  const monthlyMap = new Map<number, number>();
  const quarterlyMap = new Map<number, number>();
  const ytdMonthlyMap = new Map<number, number>();
  const weeklyMap = new Map<1 | 2 | 3 | 4, number>();

  for (const row of rowsForYear) {
    const month = getMonthFromPoDate(row.po_date);
    if (!month) {
      continue;
    }

    const amount = toNumber(row.po_amount);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + amount);

    const quarter = getQuarterFromMonth(month);
    quarterlyMap.set(quarter, (quarterlyMap.get(quarter) ?? 0) + amount);

    if (month === currentMonth) {
      const day = getDayFromPoDate(row.po_date);
      if (day) {
        const week = getWeekOfMonth(day);
        weeklyMap.set(week, (weeklyMap.get(week) ?? 0) + amount);
      }
    }
  }

  for (const row of rowsForYtd) {
    const month = getMonthFromPoDate(row.po_date);
    if (!month) {
      continue;
    }

    const amount = toNumber(row.po_amount);
    ytdMonthlyMap.set(month, (ytdMonthlyMap.get(month) ?? 0) + amount);
  }

  const weeklyRevenue: WeeklyRevenuePoint[] = buildWeekBuckets().map((bucket) => ({
    week: bucket.week,
    bookedRevenue: weeklyMap.get(bucket.week) ?? 0,
  }));

  return {
    monthlyRevenue: buildMonthBuckets(currentYear).map((bucket) => ({
      month: bucket.month,
      bookedRevenue: monthlyMap.get(bucket.month) ?? 0,
    })),
    quarterlyRevenue: buildQuarterBuckets(currentYear).map((bucket) => ({
      quarter: bucket.quarter,
      bookedRevenue: quarterlyMap.get(bucket.quarter) ?? 0,
    })),
    ytdRevenueByMonth: buildMonthBuckets(currentYear).map((bucket) => ({
      month: bucket.month,
      bookedRevenue: ytdMonthlyMap.get(bucket.month) ?? 0,
    })),
    weeklyRevenue,
  };
}

export function buildPoSummaryFromRows(
  rows: PurchaseOrderMetricRow[],
): ExecutivePoSummary {
  return {
    poCount: rows.length,
    totalPoValue: rows.reduce((sum, row) => sum + toNumber(row.po_amount), 0),
    totalMarginAmount: rows.reduce((sum, row) => sum + toNumber(row.margin_amount), 0),
  };
}

export function buildSalesPerformanceFromRows(
  rows: PurchaseOrderMetricRow[],
  ownerNameMap: Map<string, string>,
  seedOwners?: SalesRosterEntry[],
): ExecutiveSalesPerformanceRow[] {
  const aggregateMap = new Map<
    string,
    {
      ownerId: string;
      ownerName: string;
      bookedRevenue: number;
      marginAmount: number;
    }
  >();

  for (const owner of seedOwners ?? []) {
    aggregateMap.set(owner.ownerId, {
      ownerId: owner.ownerId,
      ownerName: owner.ownerName,
      bookedRevenue: 0,
      marginAmount: 0,
    });
  }

  for (const row of rows) {
    const ownerId = row.created_by ? String(row.created_by) : "unassigned";
    const fallbackOwnerName = ownerId === "unassigned" ? "Unassigned" : "Unknown";
    const ownerName = ownerNameMap.get(ownerId) ?? fallbackOwnerName;

    if (!aggregateMap.has(ownerId)) {
      aggregateMap.set(ownerId, {
        ownerId,
        ownerName,
        bookedRevenue: 0,
        marginAmount: 0,
      });
    }

    const current = aggregateMap.get(ownerId)!;
    current.bookedRevenue += toNumber(row.po_amount);
    current.marginAmount += toNumber(row.margin_amount);
  }

  return Array.from(aggregateMap.values())
    .sort((a, b) => {
      if (b.bookedRevenue !== a.bookedRevenue) {
        return b.bookedRevenue - a.bookedRevenue;
      }

      return a.ownerName.localeCompare(b.ownerName);
    })
    .map((entry) => ({
      ownerId: entry.ownerId,
      ownerName: entry.ownerName,
      bookedRevenue: entry.bookedRevenue,
      marginAmount: entry.marginAmount,
    }));
}

function assertViewerAccess(viewer?: CurrentProfile | null): void {
  if (viewer !== undefined && !isExecutiveDashboardViewer(viewer)) {
    throw new Error("Unauthorized executive dashboard access.");
  }
}

export async function getExecutiveKpiSummary(
  options: ExecutiveDashboardQueryOptions = {},
): Promise<ExecutiveKpiSummary> {
  const referenceDate = options.referenceDate ?? new Date();
  const ytdRange = getPeriodDateRange("ytd", referenceDate);

  const year = getCurrentYear(referenceDate);
  const [ytdRows, annualTarget, quarterlyTargets] = await Promise.all([
    executiveDashboardQueries.fetchPurchaseOrderRows({
      startDate: ytdRange.startDate,
      endDate: ytdRange.endDate,
    }),
    executiveDashboardQueries.fetchAnnualTarget(year),
    getQuarterlyTargets(year),
  ]);

  return buildKpiSummaryFromRows(ytdRows, annualTarget, quarterlyTargets);
}

export async function getExecutiveRevenueBreakdown(
  _periodFilter: PeriodFilter,
  options: ExecutiveDashboardQueryOptions = {},
): Promise<ExecutiveRevenueBreakdown> {
  const referenceDate = options.referenceDate ?? new Date();
  const year = getCurrentYear(referenceDate);
  const yearRange = {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
  const ytdRange = getPeriodDateRange("ytd", referenceDate);

  const [rowsForYear, rowsForYtd] = await Promise.all([
    executiveDashboardQueries.fetchPurchaseOrderRows(yearRange),
    executiveDashboardQueries.fetchPurchaseOrderRows({
      startDate: ytdRange.startDate,
      endDate: ytdRange.endDate,
    }),
  ]);

  return buildRevenueBreakdownFromRows(
    rowsForYear,
    rowsForYtd,
    referenceDate,
    options.breakdownMonth,
  );
}

export async function getExecutivePoSummary(
  periodFilter: PeriodFilter,
  options: ExecutiveDashboardQueryOptions = {},
): Promise<ExecutivePoSummary> {
  const referenceDate = options.referenceDate ?? new Date();
  const periodRange = getPeriodDateRange(periodFilter, referenceDate);
  const rows = await executiveDashboardQueries.fetchPurchaseOrderRows({
    startDate: periodRange.startDate,
    endDate: periodRange.endDate,
  });

  return buildPoSummaryFromRows(rows);
}

export async function getExecutiveSalesPerformance(
  periodFilter: PeriodFilter,
  options: ExecutiveDashboardQueryOptions = {},
): Promise<ExecutiveSalesPerformanceRow[]> {
  const referenceDate = options.referenceDate ?? new Date();
  const periodRange = getPeriodDateRange(periodFilter, referenceDate);

  const [rows, roster] = await Promise.all([
    executiveDashboardQueries.fetchPurchaseOrderRows({
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
    }),
    executiveDashboardQueries.fetchSalesRoster(),
  ]);

  const rosterIds = new Set(roster.map((entry) => entry.ownerId));
  const extraOwnerIds = Array.from(
    new Set(
      rows
        .map((row) => row.created_by)
        .filter(
          (ownerId): ownerId is string => Boolean(ownerId) && !rosterIds.has(ownerId!),
        ),
    ),
  );

  const extraUsernames =
    await executiveDashboardQueries.fetchProfileUsernames(extraOwnerIds);

  const ownerNameMap = new Map<string, string>(extraUsernames);
  for (const entry of roster) {
    ownerNameMap.set(entry.ownerId, entry.ownerName);
  }

  return buildSalesPerformanceFromRows(rows, ownerNameMap, roster);
}

export async function getExecutiveDashboardData(
  periodFilter: PeriodFilter = "ytd",
  options: ExecutiveDashboardQueryOptions = {},
): Promise<ExecutiveDashboardData> {
  assertViewerAccess(options.viewer);

  const [kpis, revenueBreakdown, poSummary, salesPerformance, charts] = await Promise.all(
    [
      getExecutiveKpiSummary(options),
      getExecutiveRevenueBreakdown(periodFilter, options),
      getExecutivePoSummary(periodFilter, options),
      getExecutiveSalesPerformance(periodFilter, options),
      getSalesDashboardCharts(),
    ],
  );

  return {
    periodFilter,
    kpis,
    revenueBreakdown,
    poSummary,
    salesPerformance,
    charts,
  };
}
