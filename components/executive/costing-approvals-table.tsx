"use client";

import {
  approveCostingQuotationAction,
  rejectCostingQuotationAction,
} from "@/app/protected/executive/costing-approvals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
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

export function ExecutiveCostingApprovalsTable({
  items,
}: ExecutiveCostingApprovalsTableProps) {
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
      <div className="rounded-md border">
        <EmptyState title="No quotations awaiting costing approval." />
      </div>
    );
  }

  const driveLink = (link: string | null) =>
    link ? (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
        aria-label="Open Google Drive link"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open
      </a>
    ) : (
      <span className="text-muted-foreground">-</span>
    );

  const reasonInput = (item: CostingApprovalItem, isBusy: boolean) => (
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
  );

  const actionButtons = (item: CostingApprovalItem, isBusy: boolean) => (
    <>
      <Button
        size="sm"
        className="flex-1"
        onClick={() => handleApprove(item)}
        disabled={isBusy}
      >
        {isBusy ? "Saving..." : "Approve"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="flex-1"
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
    </>
  );

  return (
    <ResponsiveTable
      table={
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
                  <td className="px-3 py-2">{driveLink(item.googleDriveLink)}</td>
                  <td className="px-3 py-2">{item.preparedByName}</td>
                  <td className="px-3 py-2">{reasonInput(item, isBusy)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {actionButtons(item, isBusy)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
      cards={visible.map((item) => {
        const isBusy = busyId === item.quotationId;
        return (
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
                <span className="shrink-0 font-semibold">
                  {formatCurrency(item.amount)}
                </span>
              </>
            }
            footer={
              <>
                {reasonInput(item, isBusy)}
                <div className="flex gap-2">{actionButtons(item, isBusy)}</div>
              </>
            }
          >
            <DataField label="Subject" value={item.subject || "-"} />
            <DataField
              label="Cost"
              value={item.cost === null ? "-" : formatCurrency(item.cost)}
            />
            <DataField label="Drive" value={driveLink(item.googleDriveLink)} />
            <DataField label="Prepared By" value={item.preparedByName} />
          </DataCard>
        );
      })}
    />
  );
}
