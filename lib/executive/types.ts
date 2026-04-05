export const PERIOD_FILTERS = ["monthly", "quarterly", "ytd"] as const;

export type PeriodFilter = (typeof PERIOD_FILTERS)[number];

export type ExecutiveKpiSummary = {
  revenueYtdBooked: number;
  annualTarget: number | null;
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

export type ExecutiveRevenueBreakdown = {
  monthlyRevenue: MonthlyRevenuePoint[];
  quarterlyRevenue: QuarterlyRevenuePoint[];
  ytdRevenueByMonth: MonthlyRevenuePoint[];
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

export type ExecutiveDashboardData = {
  periodFilter: PeriodFilter;
  kpis: ExecutiveKpiSummary;
  revenueBreakdown: ExecutiveRevenueBreakdown;
  salesPerformance: ExecutiveSalesPerformanceRow[];
  poSummary: ExecutivePoSummary;
};
