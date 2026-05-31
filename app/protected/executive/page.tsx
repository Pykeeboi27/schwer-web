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

  const annualTarget = dashboard.kpis.annualTarget;
  const revenueYtd = dashboard.kpis.revenueYtdBooked;
  const targetPct =
    annualTarget && annualTarget > 0
      ? Math.min(Math.round((revenueYtd / annualTarget) * 100), 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Company-wide KPI snapshot — year to date.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Revenue YTD */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-1">
            <CardDescription className="uppercase tracking-widest text-xs font-medium">
              Revenue YTD (Booked)
            </CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {formatCurrency(revenueYtd)}
            </CardTitle>
          </CardHeader>
          {targetPct !== null && annualTarget !== null ? (
            <CardContent className="pt-0">
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {targetPct}% of {formatCurrency(annualTarget)} annual target
              </p>
            </CardContent>
          ) : null}
        </Card>

        {/* Annual Target */}
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="uppercase tracking-widest text-xs font-medium">
              Annual Target
            </CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {annualTarget === null ? (
                <span className="text-muted-foreground text-xl font-normal">Not set</span>
              ) : (
                formatCurrency(annualTarget)
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Margin */}
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="uppercase tracking-widest text-xs font-medium">
              Avg. Overall Margin (YTD)
            </CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {dashboard.kpis.marginYtdWeightedPercent === null ? (
                <span className="text-muted-foreground text-xl font-normal">N/A</span>
              ) : (
                formatPercent(dashboard.kpis.marginYtdWeightedPercent)
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Target editor */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Yearly Target</CardTitle>
          <CardDescription>
            Set the annual and quarterly sales targets for {currentYear}. Only Target
            Editors can make changes.
          </CardDescription>
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
  );
}
