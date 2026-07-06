"use client";

import {
  approveQuotationAction,
  rejectQuotationAction,
} from "@/app/protected/sales/quotations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataCard, DataField, EmptyState, ResponsiveTable } from "@/components/patterns";
import type { PendingApprovalItem } from "@/lib/sales/quotations";
import { useToast } from "@/lib/utils/toast-notification";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ExecutiveApprovalsTableProps = {
  items: PendingApprovalItem[];
  currentUserRole: string | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ExecutiveApprovalsTable({
  items,
  currentUserRole,
}: ExecutiveApprovalsTableProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const normalizedRole = String(currentUserRole ?? "")
    .trim()
    .toLowerCase();
  const canApprove = normalizedRole === "owner" || normalizedRole === "executive";

  const handleApprove = async (item: PendingApprovalItem) => {
    if (!canApprove) {
      error("Only owner or executive roles can approve high-value quotations.");
      return;
    }

    setIsSubmittingId(item.approvalId);

    const response = await approveQuotationAction(item.quotationId, normalizedRole);

    if (!response.success) {
      error(response.error ?? "Failed to approve quotation.");
      setIsSubmittingId(null);
      return;
    }

    success(`Approved ${item.quotationNumber}.`);
    setIsSubmittingId(null);
    router.refresh();
  };

  const handleReject = async (item: PendingApprovalItem) => {
    if (!canApprove) {
      error("Only owner or executive roles can reject high-value quotations.");
      return;
    }

    const reason = String(reasons[item.approvalId] ?? "").trim();
    if (!reason) {
      error("Please provide a rejection reason.");
      return;
    }

    setIsSubmittingId(item.approvalId);

    const response = await rejectQuotationAction(
      item.quotationId,
      reason,
      normalizedRole,
    );

    if (!response.success) {
      error(response.error ?? "Failed to reject quotation.");
      setIsSubmittingId(null);
      return;
    }

    success(`Rejected ${item.quotationNumber}.`);
    setIsSubmittingId(null);
    router.refresh();
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border">
        <EmptyState title="No pending executive approvals at the moment." />
      </div>
    );
  }

  const reasonInput = (item: PendingApprovalItem, isBusy: boolean) => (
    <Input
      value={reasons[item.approvalId] ?? ""}
      onChange={(event) =>
        setReasons((current) => ({
          ...current,
          [item.approvalId]: event.target.value,
        }))
      }
      placeholder="Reason required for reject"
      aria-label={`Rejection reason for ${item.quotationNumber}`}
      disabled={isBusy || !canApprove}
    />
  );

  const actionButtons = (item: PendingApprovalItem, isBusy: boolean) => (
    <>
      <Button
        size="sm"
        className="flex-1"
        onClick={() => handleApprove(item)}
        disabled={isBusy || !canApprove}
      >
        {isBusy ? "Saving..." : "Approve"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="flex-1"
        onClick={() => handleReject(item)}
        disabled={isBusy || !canApprove}
      >
        Reject
      </Button>
    </>
  );

  return (
    <ResponsiveTable
      table={
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Quotation</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Required Role</th>
              <th className="px-3 py-2 font-medium">Rejection Reason</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isBusy = isSubmittingId === item.approvalId;

              return (
                <tr key={item.approvalId} className="border-t align-top">
                  <td className="px-3 py-2 font-mono text-xs">{item.quotationNumber}</td>
                  <td className="px-3 py-2">{item.subject || "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
                  <td className="px-3 py-2 capitalize">
                    {item.approverRole.replaceAll("_", " ")}
                  </td>
                  <td className="px-3 py-2">{reasonInput(item, isBusy)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">{actionButtons(item, isBusy)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
      cards={items.map((item) => {
        const isBusy = isSubmittingId === item.approvalId;

        return (
          <DataCard
            key={item.approvalId}
            header={
              <>
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.quotationNumber}
                  </p>
                  <p className="truncate font-semibold">{item.subject || "-"}</p>
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
            <DataField
              label="Required Role"
              value={
                <span className="capitalize">
                  {item.approverRole.replaceAll("_", " ")}
                </span>
              }
            />
          </DataCard>
        );
      })}
    />
  );
}
