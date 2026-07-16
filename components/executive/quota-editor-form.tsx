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
  month: number;
  monthLabel: string;
  canEdit: boolean;
};

export function QuotaEditorForm({
  entry,
  year,
  month,
  monthLabel,
  canEdit,
}: QuotaEditorFormProps) {
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
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">{entry.name}</p>
        {canEdit ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="profileId" value={entry.profileId} />
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <Label htmlFor={`quota-${entry.profileId}`} className="sr-only">
              Monthly quota for {entry.name}
            </Label>
            <NumberInput
              id={`quota-${entry.profileId}`}
              name="quotaAmount"
              placeholder="e.g. 500,000"
              defaultValue={entry.quotaAmount ?? ""}
              disabled={isPending}
              className="w-40"
            />
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : "Save quota"}
            </Button>
          </form>
        ) : null}
      </div>

      <QuotaRail
        quotaAmount={entry.quotaAmount}
        achieved={entry.achieved}
        year={year}
        month={month}
        monthLabel={monthLabel}
        canEdit={canEdit}
      />
    </div>
  );
}
