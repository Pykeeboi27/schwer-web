import { TargetEditorForm } from "@/components/executive/target-editor-form";
import {
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatProgress,
} from "@/components/patterns";
import { getExecutiveAccessRedirect, isTargetEditor } from "@/lib/executive/access";
import { getExecutiveDashboardData } from "@/lib/executive/dashboard";
import { formatCurrency, formatPercent } from "@/lib/executive/format";
import { getAverageCostingToPoDays } from "@/lib/executive/quotas";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { redirect } from "next/navigation";

function formatDays(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return `${value.toLocaleString("en-PH", { maximumFractionDigits: 1 })} days`;
}

export default async function ExecutiveDashboardPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(profile, "/protected/executive");

  if (redirectPath) {
    redirect(redirectPath);
  }

  // Independent loaders (different tables, no data dependency) run concurrently.
  // allSettled preserves each one's own fail-soft behavior instead of letting
  // one rejection abort both, as a plain Promise.all would.
  const [dashboardResult, avgCostingResult] = await Promise.allSettled([
    getExecutiveDashboardData("ytd", { viewer: profile }),
    getAverageCostingToPoDays("ytd"),
  ]);

  if (dashboardResult.status === "rejected") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Executive Dashboard"
          description="Unable to load executive metrics."
        />
        <Panel>
          <EmptyState
            title="Dashboard data unavailable"
            description="Please refresh the page or try again later."
          />
        </Panel>
      </div>
    );
  }

  const dashboard = dashboardResult.value;
  const avgCostingToPoDays =
    avgCostingResult.status === "fulfilled" ? avgCostingResult.value : null;

  const canEditTarget = isTargetEditor(profile);
  const now = new Date();
  const currentYear = now.getFullYear();

  const annualTarget = dashboard.kpis.annualTarget;
  const revenueYtd = dashboard.kpis.revenueYtdBooked;
  const targetPct =
    annualTarget && annualTarget > 0
      ? Math.min(Math.round((revenueYtd / annualTarget) * 100), 100)
      : null;

  // Everything on this page is YTD from one source (approved purchase
  // orders) -- unlike Sales Detail, there's no mixed time-scope to untangle,
  // but the reader still shouldn't have to guess the window or where the
  // numbers come from.
  const yearStart = new Date(currentYear, 0, 1);
  const scopeRange = `${new Intl.DateTimeFormat("en-PH", { day: "2-digit", month: "short" }).format(yearStart)} – ${new Intl.DateTimeFormat("en-PH", { day: "2-digit", month: "short", year: "numeric" }).format(now)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Executive Dashboard"
        description="Company-wide KPI snapshot — year to date."
        scope={[
          { label: "Scope", value: `YTD · ${scopeRange}` },
          { label: "Source", value: "Approved purchase orders" },
        ]}
      />

      {/* Lead KPI */}
      <StatCard
        label="Revenue YTD (Booked)"
        value={formatCurrency(revenueYtd)}
        accent
        size="hero"
      >
        {targetPct !== null && annualTarget !== null ? (
          <StatProgress
            percent={targetPct}
            caption={`${targetPct}% of ${formatCurrency(annualTarget)} annual target`}
            size="hero"
          />
        ) : null}
      </StatCard>

      {/* Supporting KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Annual Target"
          value={
            annualTarget === null ? (
              <span className="text-xl font-normal text-muted-foreground">Not set</span>
            ) : (
              formatCurrency(annualTarget)
            )
          }
        />

        <StatCard
          label="Avg. Overall Margin (YTD)"
          value={
            dashboard.kpis.marginYtdWeightedPercent === null ? (
              <span className="text-xl font-normal text-muted-foreground">N/A</span>
            ) : (
              formatPercent(dashboard.kpis.marginYtdWeightedPercent)
            )
          }
        />

        <StatCard
          label="Avg. Days Costing → PO (YTD)"
          value={
            avgCostingToPoDays === null ? (
              <span className="text-xl font-normal text-muted-foreground">N/A</span>
            ) : (
              formatDays(avgCostingToPoDays)
            )
          }
        />
      </div>

      <Panel
        title="Edit Yearly Target"
        description={`Set the annual and quarterly sales targets for ${currentYear}. Only Target Editors can make changes.`}
      >
        <TargetEditorForm
          year={currentYear}
          initialTarget={dashboard.kpis.annualTarget}
          initialQuarterlyTargets={dashboard.kpis.quarterlyTargets}
          canEdit={canEditTarget}
        />
      </Panel>
    </div>
  );
}
