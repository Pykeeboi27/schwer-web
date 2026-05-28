import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { ExecutiveEmptyState } from "@/components/executive/empty-state";
import { RevenueTrendChart } from "@/components/executive/revenue-trend-chart";
import { TargetEditorForm } from "@/components/executive/target-editor-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getExecutiveAccessRedirect, isTargetEditor } from "@/lib/executive/access";
import { getExecutiveDashboardData } from "@/lib/executive/dashboard";
import { formatCurrency, formatPercent } from "@/lib/executive/format";
import { PERIOD_FILTERS, type PeriodFilter } from "@/lib/executive/types";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import Link from "next/link";
import { redirect } from "next/navigation";

type ExecutiveDashboardPageProps = {
  searchParams?: Promise<{ period?: string }>;
};

function parsePeriodFilter(period: string | undefined): PeriodFilter {
  if (period && PERIOD_FILTERS.includes(period as PeriodFilter)) {
    return period as PeriodFilter;
  }
  return "ytd";
}

export default async function ExecutiveDashboardPage({
  searchParams,
}: ExecutiveDashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedPeriod = parsePeriodFilter(resolvedSearchParams?.period);

  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(profile, "/protected/executive");

  if (redirectPath) {
    redirect(redirectPath);
  }

  let dashboard;

  try {
    dashboard = await getExecutiveDashboardData(selectedPeriod, { viewer: profile });
  } catch {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Executive Dashboard</CardTitle>
            <CardDescription>Unable to load executive metrics.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutiveEmptyState
              title="Dashboard data unavailable"
              description="Please refresh the page or try again later."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEditTarget = isTargetEditor(profile);
  const currentYear = new Date().getFullYear();

  const quarterBreakdownRows = dashboard.revenueBreakdown.quarterlyRevenue;
  const monthBreakdownRows =
    selectedPeriod === "monthly"
      ? dashboard.revenueBreakdown.monthlyRevenue
      : dashboard.revenueBreakdown.ytdRevenueByMonth;

  const hasBreakdownData =
    selectedPeriod === "quarterly"
      ? quarterBreakdownRows.some((entry) => entry.bookedRevenue > 0)
      : monthBreakdownRows.some((entry) => entry.bookedRevenue > 0);
  const hasSalesPerformanceData = dashboard.salesPerformance.length > 0;

  const trendData =
    selectedPeriod === "quarterly"
      ? quarterBreakdownRows.map((e) => ({ label: `Q${e.quarter}`, value: e.bookedRevenue }))
      : monthBreakdownRows.map((e) => {
          const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          return { label: MONTH_LABELS[e.month - 1] ?? String(e.month), value: e.bookedRevenue };
        });

  const annualTarget = dashboard.kpis.annualTarget;
  const revenueYtd = dashboard.kpis.revenueYtdBooked;
  const targetPct =
    annualTarget && annualTarget > 0
      ? Math.min(Math.round((revenueYtd / annualTarget) * 100), 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Executive Dashboard</CardTitle>
          <CardDescription>
            Company-wide KPI snapshot for the selected period.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Period Filter</CardTitle>
          <CardDescription>
            Revenue breakdown, PO summary, and sales performance follow the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2" aria-label="Executive period filters">
          {PERIOD_FILTERS.map((periodFilter) => {
            const isSelected = periodFilter === selectedPeriod;
            return (
              <Link
                key={periodFilter}
                href={`/protected/executive?period=${periodFilter}`}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-current={isSelected ? "page" : undefined}
                aria-label={`Show ${periodFilter} executive metrics`}
              >
                {periodFilter}
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wide text-xs">
              Revenue YTD (Booked)
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueYtd)}</CardTitle>
          </CardHeader>
          {targetPct !== null && annualTarget !== null ? (
            <CardContent className="pt-0">
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(revenueYtd)} / {formatCurrency(annualTarget)} ({targetPct}%)
              </p>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wide text-xs">Annual Target</CardDescription>
            <CardTitle className="text-2xl">
              {annualTarget === null ? "Not set" : formatCurrency(annualTarget)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wide text-xs">
              Average Overall Margin (YTD)
            </CardDescription>
            <CardTitle className="text-2xl">
              {dashboard.kpis.marginYtdWeightedPercent === null
                ? "N/A"
                : formatPercent(dashboard.kpis.marginYtdWeightedPercent)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
          <CardDescription>
            {selectedPeriod === "quarterly"
              ? "Quarterly booked revenue for the current year"
              : selectedPeriod === "monthly"
                ? "Monthly booked revenue for the current year"
                : "YTD monthly-by-month booked revenue for the current year"}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>PO Totals and Margin Summary</CardTitle>
            <CardDescription>Summary reflects the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">PO Count:</span> {dashboard.poSummary.poCount}
            </p>
            <p>
              <span className="font-medium">Total PO Value:</span>{" "}
              {formatCurrency(dashboard.poSummary.totalPoValue)}
            </p>
            <p>
              <span className="font-medium">Total Margin:</span>{" "}
              {formatCurrency(dashboard.poSummary.totalMarginAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit Yearly Target</CardTitle>
            <CardDescription>Only Target Editors can update annual targets.</CardDescription>
          </CardHeader>
          <CardContent>
            <TargetEditorForm
              year={currentYear}
              initialTarget={dashboard.kpis.annualTarget}
              initialQuarterlyTargets={dashboard.kpis.quarterlyTargets}
              canEdit={canEditTarget}
            />
          </CardContent>
        </Card>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Sales Performance Overview</CardTitle>
          <CardDescription>Ranked by PO owner for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasSalesPerformanceData ? (
            <div className="space-y-2">
              {dashboard.salesPerformance.map((row, index) => (
                <div
                  key={row.ownerId}
                  className="grid grid-cols-[auto,1fr,auto,auto] items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium text-muted-foreground">#{index + 1}</span>
                  <span className="font-medium">{row.ownerName}</span>
                  <span>{formatCurrency(row.bookedRevenue)}</span>
                  <span>{formatCurrency(row.marginAmount)}</span>
                </div>
              ))}
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
