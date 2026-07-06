import {
  DataCard,
  DataField,
  EmptyState,
  ResponsiveTable,
  StatusBadge,
} from "@/components/patterns";
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
    return <EmptyState title="No past costing approval decisions yet." />;
  }

  return (
    <ResponsiveTable
      table={
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
                  <StatusBadge status={item.decision} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {item.rejectionReason ?? "-"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatDate(item.resolvedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      cards={items.map((item) => (
        <DataCard
          key={item.quotationId}
          header={
            <>
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.clientName}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {item.quotationNumber}
                </p>
              </div>
              <StatusBadge status={item.decision} />
            </>
          }
        >
          <DataField label="Subject" value={item.subject || "-"} />
          <DataField label="Amount" value={formatCurrency(item.amount)} />
          <DataField
            label="Cost"
            value={item.cost === null ? "-" : formatCurrency(item.cost)}
          />
          <DataField label="Prepared By" value={item.preparedByName} />
          {item.rejectionReason ? (
            <DataField
              label="Rejection Reason"
              value={
                <span className="text-muted-foreground">{item.rejectionReason}</span>
              }
            />
          ) : null}
          <DataField label="Date" value={formatDate(item.resolvedAt)} />
        </DataCard>
      ))}
    />
  );
}
