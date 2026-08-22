import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { BookedVsCollectedChart } from "@/components/executive/booked-vs-collected-chart";
import { RevenueMonthSelect } from "@/components/executive/revenue-month-select";
import { RevenueQuarterSelect } from "@/components/executive/revenue-quarter-select";
import { RevenueTrendChart } from "@/components/executive/revenue-trend-chart";
import { EmptyState } from "@/components/patterns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { getExecutiveDashboardData } from "@/lib/executive/dashboard";
import { formatCurrency, formatPercent } from "@/lib/executive/format";
import {
  buildQuarterMonthBuckets,
  getMonthLabel,
  getQuarterFromMonth,
  getQuarterLabel,
} from "@/lib/executive/period";
import { PERIOD_FILTERS, type PeriodFilter } from "@/lib/executive/types";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import Link from "next/link";
import { redirect } from "next/navigation";

type SalesDashboardPageProps = {
  searchParams?: Promise<{ period?: string; month?: string; quarter?: string }>;
};

function parsePeriodFilter(period: string | undefined): PeriodFilter {
  if (period && PERIOD_FILTERS.includes(period as PeriodFilter)) {
    return period as PeriodFilter;
  }
  return "ytd";
}

function parseBreakdownMonth(month: string | undefined, currentMonth: number): number {
  const parsed = Number(month);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return currentMonth;
  }
  return Math.min(parsed, currentMonth);
}

function parseBreakdownQuarter(
  quarter: string | undefined,
  currentQuarter: number,
): number {
  const parsed = Number(quarter);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return currentQuarter;
  }
  return Math.min(parsed, currentQuarter);
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

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = getQuarterFromMonth(currentMonth);
  const selectedMonth = parseBreakdownMonth(resolvedSearchParams?.month, currentMonth);
  const selectedQuarter = parseBreakdownQuarter(
    resolvedSearchParams?.quarter,
    currentQuarter,
  );

  let dashboard;

  try {
    dashboard = await getExecutiveDashboardData(selectedPeriod, {
      viewer: profile,
      breakdownMonth: selectedMonth,
      breakdownQuarter: selectedQuarter,
    });
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Details</CardTitle>
            <CardDescription>Unable to load sales metrics.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Sales data unavailable"
              description="Please refresh the page or try again later."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const ytdBreakdownRows = dashboard.revenueBreakdown.ytdRevenueByMonth;
  const weekBreakdownRows = dashboard.revenueBreakdown.weeklyRevenue;

  // Quarterly drills into the three months of the selected quarter, mirroring how
  // Monthly drills into the weeks of the selected month.
  const monthlyRevenueByMonth = new Map(
    dashboard.revenueBreakdown.monthlyRevenue.map((entry) => [
      entry.month,
      entry.bookedRevenue,
    ]),
  );
  const quarterBreakdownRows = buildQuarterMonthBuckets(
    selectedQuarter,
    now.getFullYear(),
  ).map((bucket) => ({
    label: bucket.label,
    bookedRevenue: monthlyRevenueByMonth.get(bucket.month) ?? 0,
  }));

  const hasBreakdownData =
    selectedPeriod === "quarterly"
      ? quarterBreakdownRows.some((entry) => entry.bookedRevenue > 0)
      : selectedPeriod === "monthly"
        ? weekBreakdownRows.some((entry) => entry.bookedRevenue > 0)
        : ytdBreakdownRows.some((entry) => entry.bookedRevenue > 0);

  const hasSalesPerformanceData = dashboard.salesPerformance.length > 0;

  const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const trendData =
    selectedPeriod === "quarterly"
      ? quarterBreakdownRows.map((e) => ({
          label: e.label,
          value: e.bookedRevenue,
        }))
      : selectedPeriod === "monthly"
        ? weekBreakdownRows.map((e) => ({
            label: `Wk ${e.week}`,
            value: e.bookedRevenue,
          }))
        : ytdBreakdownRows.map((e) => ({
            label: MONTH_LABELS[e.month - 1] ?? String(e.month),
            value: e.bookedRevenue,
          }));

  const periodScopeLabel =
    selectedPeriod === "quarterly"
      ? `${getQuarterLabel(selectedQuarter)} ${now.getFullYear()}`
      : selectedPeriod === "monthly"
        ? `${getMonthLabel(selectedMonth)} ${now.getFullYear()}`
        : `year to date ${now.getFullYear()}`;

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
      <div
        className="flex items-center gap-0 rounded-lg border bg-card overflow-hidden self-start"
        aria-label="Period filter"
      >
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Revenue Breakdown</CardTitle>
              <CardDescription>
                {selectedPeriod === "quarterly"
                  ? `Booked revenue by month for ${getQuarterLabel(selectedQuarter)} ${now.getFullYear()}${
                      selectedQuarter === currentQuarter ? " · current" : ""
                    }`
                  : selectedPeriod === "monthly"
                    ? `Booked revenue by week for ${getMonthLabel(selectedMonth)} ${now.getFullYear()}${
                        selectedMonth === currentMonth ? " · current" : ""
                      }`
                    : "Month-by-month booked revenue, year to date"}
              </CardDescription>
            </div>
            {selectedPeriod === "monthly" ? (
              <RevenueMonthSelect
                selectedMonth={selectedMonth}
                currentMonth={currentMonth}
              />
            ) : selectedPeriod === "quarterly" ? (
              <RevenueQuarterSelect
                selectedQuarter={selectedQuarter}
                currentQuarter={currentQuarter}
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {hasBreakdownData ? (
            <RevenueTrendChart data={trendData} />
          ) : (
            <EmptyState
              title="No breakdown data yet"
              description="No purchase order data is available for the selected period."
            />
          )}
        </CardContent>
      </Card>

      {/* PO summary + quick stats */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Showing {periodScopeLabel}
        </p>
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
      </div>

      {/* Purchase order collections */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders: Booked vs Collected</CardTitle>
          <CardDescription>
            How much of the period&apos;s booked PO value has actually been collected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookedVsCollectedChart
            totalBooked={dashboard.poSummary.totalPoValue}
            totalCollected={dashboard.poSummary.totalCollectedAmount}
          />
        </CardContent>
      </Card>

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
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    <th className="w-8 px-3 py-1.5 text-left font-medium">#</th>
                    <th className="px-3 py-1.5 text-left font-medium">Owner</th>
                    <th className="px-3 py-1.5 text-right font-medium">Booked Revenue</th>
                    <th className="px-3 py-1.5 text-right font-medium">Margin</th>
                    <th className="px-3 py-1.5 text-right font-medium">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.salesPerformance.map((row, index) => (
                    <tr
                      key={row.ownerId}
                      className={cn(
                        "rounded-md transition-colors hover:bg-muted/50",
                        index % 2 === 0 ? "bg-muted/20" : "",
                      )}
                    >
                      <td className="px-3 py-2.5 font-semibold text-muted-foreground tabular-nums">
                        {index + 1}
                      </td>
                      <td className="max-w-0 truncate px-3 py-2.5 font-medium">
                        {row.ownerName}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrency(row.bookedRevenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.marginAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.marginPercentAverage === null
                          ? "N/A"
                          : formatPercent(row.marginPercentAverage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No sales performance data yet"
              description="Owner ranking will appear once purchase orders are approved."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
