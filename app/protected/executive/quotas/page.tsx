import { QuotaEditorForm } from "@/components/executive/quota-editor-form";
import {
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatProgress,
} from "@/components/patterns";
import { getExecutiveAccessRedirect, isTargetEditor } from "@/lib/executive/access";
import { formatCurrency } from "@/lib/executive/format";
import { getSalesQuotaProgress } from "@/lib/executive/quotas";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { redirect } from "next/navigation";

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

  const { entries, totalAchieved: teamAchieved, unattributedAchieved } = progress;
  const withQuota = entries.filter(
    (entry) => entry.quotaAmount !== null && entry.quotaAmount > 0,
  );
  const teamQuota = withQuota.reduce((sum, entry) => sum + (entry.quotaAmount ?? 0), 0);
  const teamPercent = teamQuota > 0 ? (teamAchieved / teamQuota) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotas"
        description={`Each salesperson's ${year} annual quota, tracked against their approved purchase orders year-to-date.`}
        scope={[
          { label: "Period", value: "Year-to-date" },
          { label: "Source", value: "Approved purchase orders" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={`Team quota — ${year}`}
          value={formatCurrency(teamQuota)}
          accent
        />
        <StatCard label="Booked YTD" value={formatCurrency(teamAchieved)} />
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
            ? "Set an annual peso goal per salesperson. Progress tracks their approved purchase orders year-to-date."
            : "You can view quota progress but cannot edit it."
        }
      >
        {entries.length === 0 ? (
          <EmptyState
            title="No sales staff yet"
            description="Active sales department profiles will appear here."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {entries.map((entry) => (
              <QuotaEditorForm
                key={entry.profileId}
                entry={entry}
                year={year}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
        {unattributedAchieved > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed p-4 text-sm">
            <div>
              <p className="font-medium">Unattributed</p>
              <p className="text-xs text-muted-foreground">
                Approved POs with no active salesperson on the roster (e.g. a deactivated
                user or a coordinator-entered PO). Included in the team totals above but
                not tracked against any individual quota.
              </p>
            </div>
            <p className="shrink-0 pl-4 font-semibold tabular-nums">
              {formatCurrency(unattributedAchieved)}
            </p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
