import { getSalesSummary } from "@/lib/sales/summaries";
import { getSalesDashboardCharts } from "@/lib/sales/dashboard-charts";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
import { BeamTick, PageHeader, Panel, StatCard, StatusTile } from "@/components/patterns";
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sales Dashboard"
        description="Snapshot of client volume, quotation pipeline, and year-to-date closed vs recognized sales."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="My Closed Sales (YTD)"
          value={formatCurrency(summary.myClosedSaleTotal)}
          accent
        />
        <StatCard
          label="Company Closed Sales (YTD)"
          value={formatCurrency(summary.companyClosedSaleTotal)}
          accent
        />
      </div>

      {myQuota ? (
        <StatCard label={`My quota — ${year}`} value={formatCurrency(myQuota.achieved)}>
          <QuotaRail
            quotaAmount={myQuota.quotaAmount}
            achieved={myQuota.achieved}
            year={year}
          />
        </StatCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Active Clients" value={summary.totalClients} />
        <StatCard
          label="Recognized Sales (YTD)"
          value={formatCurrency(summary.recognizedSaleTotal)}
        />
      </div>

      <Panel title={<BeamTick>Quotations by Status</BeamTick>}>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatusTile status="draft" value={summary.quotations.draft} />
          <StatusTile status="pending" value={summary.quotations.pending} />
          <StatusTile status="approved" value={summary.quotations.approved} />
          <StatusTile status="closed" value={summary.quotations.closed} />
          <StatusTile status="rejected" value={summary.quotations.rejected} />
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
