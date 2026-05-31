import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { ExecutiveEmptyState } from "@/components/executive/empty-state";
import { RevenueTrendChart } from "@/components/executive/revenue-trend-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { getExecutiveDashboardData } from "@/lib/executive/dashboard";
import { formatCurrency } from "@/lib/executive/format";
import { PERIOD_FILTERS, type PeriodFilter } from "@/lib/executive/types";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import Link from "next/link";
import { redirect } from "next/navigation";

type SalesDashboardPageProps = {
  searchParams?: Promise<{ period?: string }>;
};

function parsePeriodFilter(period: string | undefined): PeriodFilter {
  if (period && PERIOD_FILTERS.includes(period as PeriodFilter)) {
    return period as PeriodFilter;
  }
  return "ytd";
}

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  ytd: "Year to Date",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export default async function ExecutiveSalesDashboardPage({
  searchParams,
}: SalesDashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedPeriod = parsePeriodFilter(resolvedSearchParams?.period);

  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(profile, "/protected/executive/sales");

  if (redirectPath) {
    redirect(redirectPath);
  }

  let dashboard;

  try {
    dashboard = await getExecutiveDashboardData(selectedPeriod, { viewer: profile });
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Details</CardTitle>
            <CardDescription>Unable to load sales metrics.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutiveEmptyState
              title="Sales data unavailable"
              description="Please refresh the page or try again later."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const quarterBreakdownRows = dashboard.revenueBreakdown.quarterlyRevenue;
  const ytdBreakdownRows = dashboard.revenueBreakdown.ytdRevenueByMonth;
  const weekBreakdownRows = dashboard.revenueBreakdown.weeklyRevenue;

  const hasBreakdownData =
    selectedPeriod === "quarterly"
      ? quarterBreakdownRows.some((entry) => entry.bookedRevenue > 0)
      : selectedPeriod === "monthly"
        ? weekBreakdownRows.some((entry) => entry.bookedRevenue > 0)
        : ytdBreakdownRows.some((entry) => entry.bookedRevenue > 0);

  const hasSalesPerformanceData = dashboard.salesPerformance.length > 0;

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const trendData =
    selectedPeriod === "quarterly"
      ? quarterBreakdownRows.map((e) => ({ label: `Q${e.quarter}`, value: e.bookedRevenue }))
      : selectedPeriod === "monthly"
        ? weekBreakdownRows.map((e) => ({ label: `Wk ${e.week}`, value: e.bookedRevenue }))
        : ytdBreakdownRows.map((e) => ({
            label: MONTH_LABELS[e.month - 1] ?? String(e.month),
            value: e.bookedRevenue,
          }));

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revenue breakdown, PO summary, and sales performance for the selected period.
        </p>
      </div>

      {/* Period filter — segmented control */}
      <div className="flex items-center gap-0 rounded-lg border bg-card overflow-hidden self-start" aria-label="Period filter">
        {PERIOD_FILTERS.map((periodFilter, idx) => {
          const isSelected = periodFilter === selectedPeriod;
          return (
            <Link
              key={periodFilter}
              href={`/protected/executive/sales?period=${periodFilter}`}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                idx !== PERIOD_FILTERS.length - 1 && "border-r",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={isSelected ? "page" : undefined}
              aria-label={`Show ${PERIOD_LABELS[periodFilter]} sales metrics`}
            >
              {PERIOD_LABELS[periodFilter]}
            </Link>
          );
        })}
      </div>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
          <CardDescription>
            {selectedPeriod === "quarterly"
              ? "Quarterly booked revenue for the current year"
              : selectedPeriod === "monthly"
                ? "Booked revenue by week for the current month"
                : "Month-by-month booked revenue, year to date"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasBreakdownData ? (
            <RevenueTrendChart data={trendData} />
          ) : (
            <ExecutiveEmptyState
              title="No breakdown data yet"
              description="No purchase order data is available for the selected period."
            />
          )}
        </CardContent>
      </Card>

      {/* PO summary + quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="uppercase tracking-widest text-xs font-medium">
              PO Count
            </CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {dashboard.poSummary.poCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="uppercase tracking-widest text-xs font-medium">
              Total PO Value
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatCurrency(dashboard.poSummary.totalPoValue)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="uppercase tracking-widest text-xs font-medium">
              Total Margin
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatCurrency(dashboard.poSummary.totalMarginAmount)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Sector + Client charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sector Performance</CardTitle>
            <CardDescription>Approved quotations by sector.</CardDescription>
          </CardHeader>
          <CardContent>
            <SectorPerformanceChart slices={dashboard.charts.sectorPerformance} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Distribution</CardTitle>
            <CardDescription>Top clients by approved quotation value.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientDistributionChart bars={dashboard.charts.clientDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Sales Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance Overview</CardTitle>
          <CardDescription>Ranked by PO owner for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasSalesPerformanceData ? (
            <div className="overflow-x-auto">
              {/* Header row */}
              <div className="grid grid-cols-[2rem,1fr,auto,auto] items-center gap-3 px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground border-b mb-1">
                <span>#</span>
                <span>Owner</span>
                <span className="text-right">Booked Revenue</span>
                <span className="text-right">Margin</span>
              </div>
              <div className="space-y-1">
                {dashboard.salesPerformance.map((row, index) => (
                  <div
                    key={row.ownerId}
                    className={cn(
                      "grid grid-cols-[2rem,1fr,auto,auto] items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
                      index % 2 === 0 ? "bg-muted/20" : "",
                    )}
                  >
                    <span className="font-semibold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span className="font-medium truncate">{row.ownerName}</span>
                    <span className="text-right tabular-nums">{formatCurrency(row.bookedRevenue)}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(row.marginAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ExecutiveEmptyState
              title="No sales performance data yet"
              description="Owner ranking will appear once purchase orders are approved."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
