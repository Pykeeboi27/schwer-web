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
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { redirect } from "next/navigation";

export default async function ExecutiveDashboardPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(profile, "/protected/executive");

  if (redirectPath) {
    redirect(redirectPath);
  }

  let dashboard;

  try {
    dashboard = await getExecutiveDashboardData("ytd", { viewer: profile });
  } catch {
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

  const canEditTarget = isTargetEditor(profile);
  const currentYear = new Date().getFullYear();

  const annualTarget = dashboard.kpis.annualTarget;
  const revenueYtd = dashboard.kpis.revenueYtdBooked;
  const targetPct =
    annualTarget && annualTarget > 0
      ? Math.min(Math.round((revenueYtd / annualTarget) * 100), 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Executive Dashboard"
        description="Company-wide KPI snapshot — year to date."
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
      <div className="grid gap-3 sm:grid-cols-2">
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
