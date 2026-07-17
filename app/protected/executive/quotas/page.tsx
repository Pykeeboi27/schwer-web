import { QuotaEditorForm } from "@/components/executive/quota-editor-form";
import { EmptyState, PageHeader, Panel } from "@/components/patterns";
import { getExecutiveAccessRedirect, isTargetEditor } from "@/lib/executive/access";
import { getMonthLabel } from "@/lib/executive/period";
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
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = getMonthLabel(month);

  let progress;

  try {
    progress = await getSalesQuotaProgress(year, month);
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotas"
        description={`Set each salesperson's ${monthLabel} quota and track their progress against approved purchase orders.`}
      />

      <Panel
        title={`${monthLabel} quotas`}
        description={
          canEdit
            ? "Set a monthly peso goal per salesperson. Progress tracks their approved purchase orders for the month."
            : "You can view quota progress but cannot edit it."
        }
      >
        {progress.length === 0 ? (
          <EmptyState
            title="No sales staff yet"
            description="Active sales department profiles will appear here."
          />
        ) : (
          <div className="space-y-3">
            {progress.map((entry) => (
              <QuotaEditorForm
                key={entry.profileId}
                entry={entry}
                year={year}
                month={month}
                monthLabel={monthLabel}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
