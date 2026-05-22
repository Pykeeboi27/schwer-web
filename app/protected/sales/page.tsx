import { getSalesSummary } from "@/lib/sales/summaries";
import { getSalesDashboardCharts } from "@/lib/sales/dashboard-charts";
import { SectorPerformanceChart } from "@/components/sales/sector-performance-chart";
import { ClientDistributionChart } from "@/components/sales/client-distribution-chart";
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

  const [summary, charts] = await Promise.all([getSalesSummary(), getSalesDashboardCharts()]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card p-5">
        <h1 className="text-2xl font-semibold">Sales Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Snapshot of client volume, quotation pipeline, and closed vs recognized sales.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Active Clients</h2>
          <p className="mt-2 text-2xl font-semibold">{summary.totalClients}</p>
        </div>

        <div className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Closed Sales</h2>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.closedSaleTotal)}</p>
        </div>

        <div className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Recognized Sales</h2>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.recognizedSaleTotal)}</p>
        </div>
      </div>

      <div className="rounded-md border bg-card p-4">
        <h2 className="text-lg font-semibold">Quotations by Status</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border p-3 text-sm">
            <p className="text-muted-foreground">Draft</p>
            <p className="mt-1 text-xl font-semibold">{summary.quotations.draft}</p>
          </div>
          <div className="rounded border p-3 text-sm">
            <p className="text-muted-foreground">Pending</p>
            <p className="mt-1 text-xl font-semibold">{summary.quotations.pending}</p>
          </div>
          <div className="rounded border p-3 text-sm">
            <p className="text-muted-foreground">Approved</p>
            <p className="mt-1 text-xl font-semibold">{summary.quotations.approved}</p>
          </div>
          <div className="rounded border p-3 text-sm">
            <p className="text-muted-foreground">Rejected</p>
            <p className="mt-1 text-xl font-semibold">{summary.quotations.rejected}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border bg-card p-4">
          <h2 className="text-lg font-semibold">Sector Performance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved quotation value by client sector.
          </p>
          <div className="mt-4">
            <SectorPerformanceChart slices={charts.sectorPerformance} />
          </div>
        </div>

        <div className="rounded-md border bg-card p-4">
          <h2 className="text-lg font-semibold">Client Quotation Distribution</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved quotation value per client, highest first.
          </p>
          <div className="mt-4">
            <ClientDistributionChart bars={charts.clientDistribution} />
          </div>
        </div>
      </div>
    </div>
  );
}
