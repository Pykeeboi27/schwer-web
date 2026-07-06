import { getSalesSummary } from "@/lib/sales/summaries";
import { getSalesDashboardCharts } from "@/lib/sales/dashboard-charts";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
import { BeamTick, PageHeader, Panel, StatCard } from "@/components/patterns";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { redirect } from "next/navigation";

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

  const [summary, charts] = await Promise.all([
    getSalesSummary(),
    getSalesDashboardCharts(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Dashboard"
        description="Snapshot of client volume, quotation pipeline, and closed vs recognized sales."
      />

      <StatCard
        label="Closed Sales"
        value={formatCurrency(summary.closedSaleTotal)}
        accent
        size="hero"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Active Clients" value={summary.totalClients} />
        <StatCard
          label="Recognized Sales"
          value={formatCurrency(summary.recognizedSaleTotal)}
        />
      </div>

      <Panel title={<BeamTick>Quotations by Status</BeamTick>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Draft", value: summary.quotations.draft },
            { label: "Pending", value: summary.quotations.pending },
            { label: "Approved", value: summary.quotations.approved },
            { label: "Rejected", value: summary.quotations.rejected },
          ].map((item) => (
            <div key={item.label} className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
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
          <ClientDistributionChart bars={charts.clientDistribution} />
        </Panel>
      </div>
    </div>
  );
}
