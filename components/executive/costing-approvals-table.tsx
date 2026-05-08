"use client";

import {
  approveCostingQuotationAction,
  rejectCostingQuotationAction,
} from "@/app/protected/executive/costing-approvals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CostingApprovalItem } from "@/lib/executive/costing-approvals";
import { useToast } from "@/lib/utils/toast-notification";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ExecutiveCostingApprovalsTableProps = {
  items: CostingApprovalItem[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ExecutiveCostingApprovalsTable({ items }: ExecutiveCostingApprovalsTableProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => items.filter((item) => !dismissedIds.has(item.quotationId)),
    [items, dismissedIds],
  );

  const handleApprove = async (item: CostingApprovalItem) => {
    setBusyId(item.quotationId);
    const response = await approveCostingQuotationAction(item.quotationId);
    if (!response.success) {
      error(response.error ?? "Failed to approve costing quotation.");
      setBusyId(null);
      return;
    }
    success(`Approved costing for ${item.quotationNumber}.`);
    setBusyId(null);
    router.refresh();
  };

  const handleReject = async (item: CostingApprovalItem) => {
    const reason = String(reasons[item.quotationId] ?? "").trim();
    if (!reason) {
      error("Please provide a rejection reason.");
      return;
    }
    setBusyId(item.quotationId);
    const response = await rejectCostingQuotationAction(item.quotationId, reason);
    if (!response.success) {
      error(response.error ?? "Failed to reject costing quotation.");
      setBusyId(null);
      return;
    }
    success(`Rejected ${item.quotationNumber}; sent back to engineering.`);
    setBusyId(null);
    router.refresh();
  };

  const handleClose = (item: CostingApprovalItem) => {
    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(item.quotationId);
      return next;
    });
  };

  if (visible.length === 0) {
    return (
      <div className="rounded-md border bg-card p-5 text-sm text-muted-foreground">
        No quotations awaiting costing approval.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Quotation</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Cost</th>
            <th className="px-3 py-2 font-medium">Drive</th>
            <th className="px-3 py-2 font-medium">Prepared By</th>
            <th className="px-3 py-2 font-medium">Rejection Reason</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item) => {
            const isBusy = busyId === item.quotationId;
            return (
              <tr key={item.quotationId} className="border-t align-top">
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
                <td className="px-3 py-2">{item.preparedByName}</td>
                <td className="px-3 py-2">
                  <Input
                    value={reasons[item.quotationId] ?? ""}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [item.quotationId]: event.target.value,
                      }))
                    }
                    placeholder="Reason required for reject"
                    aria-label={`Rejection reason for ${item.quotationNumber}`}
                    disabled={isBusy}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleApprove(item)} disabled={isBusy}>
                      {isBusy ? "Saving..." : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(item)}
                      disabled={isBusy}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleClose(item)}
                      disabled={isBusy}
                    >
                      Close
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
