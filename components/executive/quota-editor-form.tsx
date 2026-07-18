"use client";

import { updateSalesQuotaAction } from "@/app/protected/executive/quotas/actions";
import { INITIAL_UPDATE_QUOTA_STATE } from "@/app/protected/executive/quotas/quota-state";
import { QuotaRail } from "@/components/executive/quota-rail";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import type { SalesQuotaProgress } from "@/lib/executive/quotas";
import { useToast } from "@/lib/utils/toast-notification";
import { useActionState, useEffect } from "react";

type QuotaEditorFormProps = {
  entry: SalesQuotaProgress;
  year: number;
  canEdit: boolean;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function QuotaEditorForm({ entry, year, canEdit }: QuotaEditorFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateSalesQuotaAction,
    INITIAL_UPDATE_QUOTA_STATE,
  );
  const toast = useToast();

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
      return;
    }

    if (state.success && state.message) {
      toast.success(state.message);
    }
  }, [state.error, state.message, state.success, toast]);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          >
            {getInitials(entry.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{entry.name}</p>
            <p className="text-xs text-muted-foreground">{year} annual quota</p>
          </div>
        </div>

        {canEdit ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="profileId" value={entry.profileId} />
            <input type="hidden" name="year" value={year} />
            <Label htmlFor={`quota-${entry.profileId}`} className="sr-only">
              {year} quota for {entry.name}
            </Label>
            <NumberInput
              id={`quota-${entry.profileId}`}
              name="quotaAmount"
              placeholder="e.g. 6,000,000"
              defaultValue={entry.quotaAmount ?? ""}
              disabled={isPending}
              className="w-44"
            />
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        ) : null}
      </div>

      <div className="mt-4">
        <QuotaRail
          quotaAmount={entry.quotaAmount}
          achieved={entry.achieved}
          year={year}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
