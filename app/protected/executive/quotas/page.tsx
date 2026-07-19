import { QuotaEditorForm } from "@/components/executive/quota-editor-form";
import { EmptyState, PageHeader, Panel, StatCard, StatProgress } from "@/components/patterns";
import { getExecutiveAccessRedirect, isTargetEditor } from "@/lib/executive/access";
import { getSalesQuotaProgress } from "@/lib/executive/quotas";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { redirect } from "next/navigation";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ExecutiveQuotasPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(profile, "/protected/executive/quotas");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const canEdit = isTargetEditor(profile);
  const year = new Date().getFullYear();

  let progress;

  try {
    progress = await getSalesQuotaProgress(year);
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Quotas" description="Unable to load sales quotas." />
        <Panel>
          <EmptyState
            title="Quotas unavailable"
            description="Please refresh the page or try again later."
          />
        </Panel>
      </div>
    );
  }

  const withQuota = progress.filter(
    (entry) => entry.quotaAmount !== null && entry.quotaAmount > 0,
  );
  const teamQuota = withQuota.reduce((sum, entry) => sum + (entry.quotaAmount ?? 0), 0);
  const teamAchieved = progress.reduce((sum, entry) => sum + entry.achieved, 0);
  const teamPercent = teamQuota > 0 ? (teamAchieved / teamQuota) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotas"
        description={`Each salesperson's ${year} annual quota, tracked against their approved purchase orders for the year.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={`Team quota — ${year}`} value={formatCurrency(teamQuota)} accent />
        <StatCard label="Booked this year" value={formatCurrency(teamAchieved)} />
        <StatCard
          label="Team attainment"
          value={teamPercent === null ? "—" : `${Math.round(teamPercent)}%`}
        >
          {teamPercent === null ? (
            <p className="text-xs text-muted-foreground">
              {canEdit
                ? "Set quotas below to start tracking attainment."
                : "No quotas set yet."}
            </p>
          ) : (
            <StatProgress
              percent={teamPercent}
              caption={`${formatCurrency(teamAchieved)} of ${formatCurrency(teamQuota)}`}
            />
          )}
        </StatCard>
      </div>

      <Panel
        title={`${year} quotas by salesperson`}
        description={
          canEdit
            ? "Set an annual peso goal per salesperson. Progress tracks their approved purchase orders across the year."
            : "You can view quota progress but cannot edit it."
        }
      >
        {progress.length === 0 ? (
          <EmptyState
            title="No sales staff yet"
            description="Active sales department profiles will appear here."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {progress.map((entry) => (
              <QuotaEditorForm
                key={entry.profileId}
                entry={entry}
                year={year}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
