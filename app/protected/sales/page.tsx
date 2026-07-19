import { getSalesSummary } from "@/lib/sales/summaries";
import { getSalesDashboardCharts } from "@/lib/sales/dashboard-charts";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
import { BeamTick, PageHeader, Panel, StatCard } from "@/components/patterns";
import { QuotaRail } from "@/components/executive/quota-rail";
import { getMyQuotaProgress } from "@/lib/executive/quotas";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { redirect } from "next/navigation";

const QUOTA_HOLDER_ROLES = new Set(["sales_staff", "sales_manager"]);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function SalesDashboardPage() {
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(profile, "/protected/sales");

  if (redirectPath) {
    redirect(redirectPath);
  }

  const isQuotaHolder = Boolean(profile?.role && QUOTA_HOLDER_ROLES.has(profile.role));
  const year = new Date().getFullYear();

  const [summary, charts, myQuota] = await Promise.all([
    getSalesSummary(profile?.id ?? ""),
    getSalesDashboardCharts(),
    isQuotaHolder && profile
      ? getMyQuotaProgress(profile.id, year)
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Dashboard"
        description="Snapshot of client volume, quotation pipeline, and closed vs recognized sales."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="My Closed Sales"
          value={formatCurrency(summary.myClosedSaleTotal)}
          accent
        />
        <StatCard
          label="Company Closed Sales"
          value={formatCurrency(summary.companyClosedSaleTotal)}
          accent
        />
      </div>

      {myQuota ? (
        <StatCard
          label={`My quota — ${year}`}
          value={formatCurrency(myQuota.achieved)}
        >
          <QuotaRail
            quotaAmount={myQuota.quotaAmount}
            achieved={myQuota.achieved}
            year={year}
          />
        </StatCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Active Clients" value={summary.totalClients} />
        <StatCard
          label="Recognized Sales"
          value={formatCurrency(summary.recognizedSaleTotal)}
        />
      </div>

      <Panel title={<BeamTick>Quotations by Status</BeamTick>}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              label: "Draft",
              value: summary.quotations.draft,
              className:
                "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40",
              valueClassName: "text-slate-600 dark:text-slate-300",
            },
            {
              label: "Pending",
              value: summary.quotations.pending,
              className:
                "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
              valueClassName: "text-amber-700 dark:text-amber-300",
            },
            {
              label: "Approved",
              value: summary.quotations.approved,
              className:
                "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
              valueClassName: "text-green-700 dark:text-green-300",
            },
            {
              label: "Closed",
              value: summary.quotations.closed,
              className:
                "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40",
              valueClassName: "text-blue-700 dark:text-blue-300",
            },
            {
              label: "Rejected",
              value: summary.quotations.rejected,
              className:
                "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
              valueClassName: "text-red-700 dark:text-red-300",
            },
          ].map((item) => (
            <div key={item.label} className={`rounded-md border p-3 ${item.className}`}>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p
                className={`mt-1 text-xl font-semibold tabular-nums ${item.valueClassName}`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Sector Performance"
          description="Approved quotation value by client sector."
        >
          <SectorPerformanceChart slices={charts.sectorPerformance} />
        </Panel>

        <Panel
          title="Client Quotation Distribution"
          description="Approved quotation value per client, highest first."
        >
          <ClientDistributionChart
            bars={charts.clientDistribution}
            limit={charts.clientDistribution.length}
            scrollable
          />
        </Panel>
      </div>
    </div>
  );
}
