import { isExecutiveDashboardViewer } from "@/lib/executive/access";
import {
  buildMonthBuckets,
  buildQuarterBuckets,
  getCurrentYear,
  getPeriodDateRange,
  getQuarterFromMonth,
} from "@/lib/executive/period";
import type {
  ExecutiveDashboardData,
  ExecutiveKpiSummary,
  ExecutivePoSummary,
  ExecutiveRevenueBreakdown,
  ExecutiveSalesPerformanceRow,
  PeriodFilter,
} from "@/lib/executive/types";
import type { CurrentProfile } from "@/lib/profile/get-current-profile";
import { createClient } from "@/lib/supabase/server";

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
};

export const EMPTY_EXECUTIVE_KPIS: ExecutiveKpiSummary = {
  revenueYtdBooked: 0,
  annualTarget: null,
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

export const executiveDashboardQueries = {
  async fetchPurchaseOrderRows(range: PurchaseOrderRange): Promise<PurchaseOrderMetricRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("po_amount, margin_amount, po_date, created_by")
      .gte("po_date", range.startDate)
      .lte("po_date", range.endDate);

    if (error) {
      throw new Error("Failed to load executive dashboard purchase orders.");
    }

    return (data ?? []) as PurchaseOrderMetricRow[];
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

  async fetchProfileNames(profileIds: string[]): Promise<Map<string, string>> {
    if (profileIds.length === 0) {
      return new Map();
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);

    if (error) {
      return new Map();
    }

    const nameMap = new Map<string, string>();

    for (const row of data ?? []) {
      const id = String(row.id ?? "");
      if (!id) {
        continue;
      }

      const fullName = String(row.full_name ?? "").trim();
      if (fullName) {
        nameMap.set(id, fullName);
      }
    }

    return nameMap;
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
): ExecutiveKpiSummary {
  const totals = summarizeRevenueAndMargin(rows);

  return {
    revenueYtdBooked: totals.bookedRevenue,
    annualTarget,
    revenueVsTargetDelta:
      annualTarget === null ? null : totals.bookedRevenue - annualTarget,
    marginYtdWeightedPercent: totals.weightedMarginPercent,
  };
}

export function buildRevenueBreakdownFromRows(
  rowsForYear: PurchaseOrderMetricRow[],
  rowsForYtd: PurchaseOrderMetricRow[],
  referenceDate: Date,
): ExecutiveRevenueBreakdown {
  const currentYear = getCurrentYear(referenceDate);

  const monthlyMap = new Map<number, number>();
  const quarterlyMap = new Map<number, number>();
  const ytdMonthlyMap = new Map<number, number>();

  for (const row of rowsForYear) {
    const month = getMonthFromPoDate(row.po_date);
    if (!month) {
      continue;
    }

    const amount = toNumber(row.po_amount);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + amount);

    const quarter = getQuarterFromMonth(month);
    quarterlyMap.set(quarter, (quarterlyMap.get(quarter) ?? 0) + amount);
  }

  for (const row of rowsForYtd) {
    const month = getMonthFromPoDate(row.po_date);
    if (!month) {
      continue;
    }

    const amount = toNumber(row.po_amount);
    ytdMonthlyMap.set(month, (ytdMonthlyMap.get(month) ?? 0) + amount);
  }

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
  };
}

export function buildPoSummaryFromRows(rows: PurchaseOrderMetricRow[]): ExecutivePoSummary {
  return {
    poCount: rows.length,
    totalPoValue: rows.reduce((sum, row) => sum + toNumber(row.po_amount), 0),
    totalMarginAmount: rows.reduce((sum, row) => sum + toNumber(row.margin_amount), 0),
  };
}

export function buildSalesPerformanceFromRows(
  rows: PurchaseOrderMetricRow[],
  ownerNameMap: Map<string, string>,
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

  for (const row of rows) {
    const ownerId = row.created_by ? String(row.created_by) : "unassigned";
    const fallbackOwnerName =
      ownerId === "unassigned" ? "Unassigned" : `Owner ${ownerId.slice(0, 8)}`;
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

  const [ytdRows, annualTarget] = await Promise.all([
    executiveDashboardQueries.fetchPurchaseOrderRows({
      startDate: ytdRange.startDate,
      endDate: ytdRange.endDate,
    }),
    executiveDashboardQueries.fetchAnnualTarget(getCurrentYear(referenceDate)),
  ]);

  return buildKpiSummaryFromRows(ytdRows, annualTarget);
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

  return buildRevenueBreakdownFromRows(rowsForYear, rowsForYtd, referenceDate);
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
  const rows = await executiveDashboardQueries.fetchPurchaseOrderRows({
    startDate: periodRange.startDate,
    endDate: periodRange.endDate,
  });

  const ownerIds = Array.from(
    new Set(
      rows
        .map((row) => row.created_by)
        .filter((ownerId): ownerId is string => Boolean(ownerId)),
    ),
  );

  const ownerNameMap = await executiveDashboardQueries.fetchProfileNames(ownerIds);

  return buildSalesPerformanceFromRows(rows, ownerNameMap);
}

export async function getExecutiveDashboardData(
  periodFilter: PeriodFilter = "ytd",
  options: ExecutiveDashboardQueryOptions = {},
): Promise<ExecutiveDashboardData> {
  assertViewerAccess(options.viewer);

  const [kpis, revenueBreakdown, poSummary, salesPerformance] = await Promise.all([
    getExecutiveKpiSummary(options),
    getExecutiveRevenueBreakdown(periodFilter, options),
    getExecutivePoSummary(periodFilter, options),
    getExecutiveSalesPerformance(periodFilter, options),
  ]);

  return {
    periodFilter,
    kpis,
    revenueBreakdown,
    poSummary,
    salesPerformance,
  };
}
