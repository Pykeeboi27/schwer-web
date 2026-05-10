import type { CostingApprovedHistoryItem } from "@/lib/engineering/costing-quotations";
import { ExternalLink } from "lucide-react";

type CostingHistoryTableProps = {
  items: CostingApprovedHistoryItem[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CostingHistoryTable({ items }: CostingHistoryTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No approved costing quotations yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Quotation</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Cost</th>
            <th className="px-3 py-2 font-medium">Drive</th>
            <th className="px-3 py-2 font-medium">Approved At</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.quotationId} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{item.quotationNumber}</td>
              <td className="px-3 py-2">{item.clientName}</td>
              <td className="px-3 py-2">{item.subject || "-"}</td>
              <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
              <td className="px-3 py-2">
                {item.cost === null ? "-" : formatCurrency(item.cost)}
              </td>
              <td className="px-3 py-2">
                {item.googleDriveLink ? (
                  <a
                    href={item.googleDriveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    aria-label="Open Google Drive link"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(item.approvedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
