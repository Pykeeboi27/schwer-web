import { ExecutiveQuotationsView } from "@/components/executive/executive-quotations-view";
import { EmptyState, PageHeader, Panel } from "@/components/patterns";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";
import { getExecutiveAccessRedirect } from "@/lib/executive/access";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { redirect } from "next/navigation";

export default async function ExecutiveQuotationsPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getExecutiveAccessRedirect(
    profile,
    "/protected/executive/quotations",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  // No department/role args: executives get the full, unrestricted list (RLS
  // now grants executives/owners unrestricted SELECT on quotations -- see
  // migrations/0021_executive_quotation_visibility.sql). Passing a role here
  // would trigger fetchQuotationsAction's >=3M client-side restriction, which
  // exists for the Approvals worklist, not this tracking view.
  const quotationsResponse = await fetchQuotationsAction();
  const quotations = quotationsResponse.success ? (quotationsResponse.data ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["quotations", "quotation_approvals"]} />
      <PageHeader
        title="Quotations"
        description="Every quotation across Sales, regardless of amount or status."
      />

      <Panel>
        {quotationsResponse.success ? (
          <ExecutiveQuotationsView
            quotations={quotations}
            currentUserId={profile?.id ?? ""}
            currentUserRole={profile?.role ?? null}
          />
        ) : (
          <EmptyState
            title="Quotations unavailable"
            description="Please refresh the page or try again later."
          />
        )}
      </Panel>
    </div>
  );
}
