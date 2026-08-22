import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { BookedVsCollectedChart } from "@/components/executive/booked-vs-collected-chart";
import { RevenueMonthSelect } from "@/components/executive/revenue-month-select";
import { RevenueQuarterSelect } from "@/components/executive/revenue-quarter-select";
import { RevenueTrendChart } from "@/components/executive/revenue-trend-chart";
import {
  DataTableHead,
  DataTableHeaderCell,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
} from "@/components/patterns";
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
import type { ReactNode } from "react";

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

/**
 * A ruled band label, echoing the landing page's drafting-sheet hairlines:
 * a short eyebrow, a rule filling the rest of the width, and an optional
 * right-aligned note. Used here to mark where the page's time scope changes
 * -- the one fact the old plain-card layout left the reader to guess at.
 */
function ScopeRule({ label, note }: { label: string; note?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      {note ? (
        <span className="shrink-0 text-xs font-medium text-foreground">{note}</span>
      ) : null}
    </div>
  );
}

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
        <PageHeader title="Sales Detail" description="Unable to load sales metrics." />
        <Panel>
          <EmptyState
            title="Sales data unavailable"
            description="Please refresh the page or try again later."
          />
        </Panel>
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
        : `Year to date ${now.getFullYear()}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Detail"
        description="Revenue breakdown, PO summary, and sales performance for the selected period."
      />

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
      <Panel
        title="Revenue Breakdown"
        description={
          selectedPeriod === "quarterly"
            ? `Booked revenue by month for ${getQuarterLabel(selectedQuarter)} ${now.getFullYear()}${
                selectedQuarter === currentQuarter ? " · current" : ""
              }`
            : selectedPeriod === "monthly"
              ? `Booked revenue by week for ${getMonthLabel(selectedMonth)} ${now.getFullYear()}${
                  selectedMonth === currentMonth ? " · current" : ""
                }`
              : "Month-by-month booked revenue, year to date"
        }
        actions={
          selectedPeriod === "monthly" ? (
            <RevenueMonthSelect
              selectedMonth={selectedMonth}
              currentMonth={currentMonth}
            />
          ) : selectedPeriod === "quarterly" ? (
            <RevenueQuarterSelect
              selectedQuarter={selectedQuarter}
              currentQuarter={currentQuarter}
            />
          ) : undefined
        }
      >
        {hasBreakdownData ? (
          <RevenueTrendChart data={trendData} />
        ) : (
          <EmptyState
            title="No breakdown data yet"
            description="No purchase order data is available for the selected period."
          />
        )}
      </Panel>

      {/* PO summary + quick stats — everything below this rule, up to the
          all-time section, is scoped to the period filter above. */}
      <div className="flex flex-col gap-3">
        <ScopeRule label="Period" note={periodScopeLabel} />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="PO Count" value={dashboard.poSummary.poCount} />
          <StatCard
            label="Total PO Value"
            value={formatCurrency(dashboard.poSummary.totalPoValue)}
          />
          <StatCard
            label="Total Margin"
            value={formatCurrency(dashboard.poSummary.totalMarginAmount)}
          />
        </div>
      </div>

      {/* Purchase order collections */}
      <Panel
        title="Purchase Orders: Booked vs Collected"
        description="How much of the period's booked PO value has actually been collected."
      >
        <BookedVsCollectedChart
          totalBooked={dashboard.poSummary.totalPoValue}
          totalCollected={dashboard.poSummary.totalCollectedAmount}
        />
      </Panel>

      {/* Sector + Client charts — these aggregate all-time approved
          quotations, not the period filter above, so they're marked off with
          their own rule rather than implying they share that scope. */}
      <div className="flex flex-col gap-3">
        <ScopeRule label="All time" note="Not filtered by period" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Sector Performance" description="Approved quotations by sector.">
            <SectorPerformanceChart slices={dashboard.charts.sectorPerformance} />
          </Panel>

          <Panel
            title="Client Distribution"
            description="Top clients by approved quotation value."
          >
            <ClientDistributionChart bars={dashboard.charts.clientDistribution} />
          </Panel>
        </div>
      </div>

      {/* Sales Performance Overview */}
      <Panel
        title="Sales Performance Overview"
        description="Ranked by PO owner for the selected period."
        padded={false}
      >
        {hasSalesPerformanceData ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <DataTableHead>
                <tr className="border-b text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <DataTableHeaderCell className="w-8 text-left">#</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-left">Owner</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    Booked Revenue
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">Margin</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    Margin %
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <tbody>
                {dashboard.salesPerformance.map((row, index) => (
                  <tr
                    key={row.ownerId}
                    className={cn(
                      "border-t transition-colors hover:bg-muted/50",
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
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No sales performance data yet"
              description="Owner ranking will appear once purchase orders are approved."
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
