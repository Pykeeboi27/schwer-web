import { ExecutiveEmptyState } from "@/components/executive/empty-state";
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Executive Dashboard</CardTitle>
          <CardDescription>
            Company-wide KPI snapshot for leadership. Interactive period filters and target editing
            controls are implemented in story tasks.
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
            <CardDescription>Revenue YTD (Booked)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(dashboard.kpis.revenueYtdBooked)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Annual Target</CardDescription>
            <CardTitle className="text-2xl">
              {dashboard.kpis.annualTarget === null
                ? "Not set"
                : formatCurrency(dashboard.kpis.annualTarget)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Overall Margin (YTD)</CardDescription>
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
            <div className="space-y-2">
              {selectedPeriod === "quarterly" ? (
                quarterBreakdownRows.map((entry) => (
                  <div
                    key={entry.quarter}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>Q{entry.quarter}</span>
                    <span className="font-medium">{formatCurrency(entry.bookedRevenue)}</span>
                  </div>
                ))
              ) : (
                monthBreakdownRows.map((entry) => (
                  <div
                    key={entry.month}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>Month {entry.month}</span>
                    <span className="font-medium">{formatCurrency(entry.bookedRevenue)}</span>
                  </div>
                ))
              )}
            </div>
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
              canEdit={canEditTarget}
            />
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
              description="Owner ranking will appear after sales performance aggregation is implemented."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
