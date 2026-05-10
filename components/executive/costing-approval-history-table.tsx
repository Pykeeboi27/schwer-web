import type { CostingApprovalHistoryItem } from "@/lib/executive/costing-approvals";

type CostingApprovalHistoryTableProps = {
  items: CostingApprovalHistoryItem[];
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

export function CostingApprovalHistoryTable({ items }: CostingApprovalHistoryTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No past costing approval decisions yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Quotation</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Cost</th>
            <th className="px-3 py-2 font-medium">Prepared By</th>
            <th className="px-3 py-2 font-medium">Decision</th>
            <th className="px-3 py-2 font-medium">Rejection Reason</th>
            <th className="px-3 py-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.quotationId} className="border-t align-top">
              <td className="px-3 py-2 font-mono text-xs">{item.quotationNumber}</td>
              <td className="px-3 py-2">{item.clientName}</td>
              <td className="px-3 py-2">{item.subject || "-"}</td>
              <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
              <td className="px-3 py-2">
                {item.cost === null ? "-" : formatCurrency(item.cost)}
              </td>
              <td className="px-3 py-2">{item.preparedByName}</td>
              <td className="px-3 py-2">
                {item.decision === "approved" ? (
                  <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Approved
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Rejected
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {item.rejectionReason ?? "-"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(item.resolvedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
