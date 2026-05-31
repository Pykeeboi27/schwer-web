export const PERIOD_FILTERS = ["monthly", "quarterly", "ytd"] as const;

export type PeriodFilter = (typeof PERIOD_FILTERS)[number];

export type QuarterlyTargets = {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
};

export type ExecutiveKpiSummary = {
  revenueYtdBooked: number;
  annualTarget: number | null;
  quarterlyTargets: QuarterlyTargets;
  revenueVsTargetDelta: number | null;
  marginYtdWeightedPercent: number | null;
};

export type MonthlyRevenuePoint = {
  month: number;
  bookedRevenue: number;
};

export type QuarterlyRevenuePoint = {
  quarter: number;
  bookedRevenue: number;
};

export type WeeklyRevenuePoint = {
  week: 1 | 2 | 3 | 4;
  bookedRevenue: number;
};

export type ExecutiveRevenueBreakdown = {
  monthlyRevenue: MonthlyRevenuePoint[];
  quarterlyRevenue: QuarterlyRevenuePoint[];
  ytdRevenueByMonth: MonthlyRevenuePoint[];
  weeklyRevenue: WeeklyRevenuePoint[];
};

export type ExecutiveSalesPerformanceRow = {
  ownerId: string;
  ownerName: string;
  bookedRevenue: number;
  marginAmount: number;
};

export type ExecutivePoSummary = {
  poCount: number;
  totalPoValue: number;
  totalMarginAmount: number;
};

import type { SalesDashboardCharts } from "@/lib/sales/dashboard-charts";

export type ExecutiveDashboardData = {
  periodFilter: PeriodFilter;
  kpis: ExecutiveKpiSummary;
  revenueBreakdown: ExecutiveRevenueBreakdown;
  salesPerformance: ExecutiveSalesPerformanceRow[];
  poSummary: ExecutivePoSummary;
  charts: SalesDashboardCharts;
};
