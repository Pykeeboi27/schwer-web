"use client";

import { updateAnnualTargetAction } from "@/app/protected/executive/actions";
import { INITIAL_UPDATE_TARGET_STATE } from "@/app/protected/executive/target-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import type { QuarterlyTargets } from "@/lib/executive/types";
import { useToast } from "@/lib/utils/toast-notification";
import { useActionState, useEffect } from "react";

type TargetEditorFormProps = {
  year: number;
  initialTarget: number | null;
  initialQuarterlyTargets?: QuarterlyTargets;
  canEdit: boolean;
};

const QUARTERS = [1, 2, 3, 4] as const;

export function TargetEditorForm({
  year,
  initialTarget,
  initialQuarterlyTargets,
  canEdit,
}: TargetEditorFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateAnnualTargetAction,
    INITIAL_UPDATE_TARGET_STATE,
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

  const qTargets = initialQuarterlyTargets ?? { q1: null, q2: null, q3: null, q4: null };

  // Quarterly inputs are only enabled once an annual target has been set.
  const annualSet = initialTarget !== null && initialTarget > 0;

  return (
    <div className="space-y-6">
      {/* Annual target */}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="year" value={year} />
        <Label htmlFor="targetAmount" className="text-sm font-medium">
          Annual target ({year})
        </Label>
        <div className="flex gap-2">
          <NumberInput
            id="targetAmount"
            name="targetAmount"
            placeholder="e.g. 5,000,000"
            required
            defaultValue={initialTarget === null ? "" : initialTarget}
            disabled={!canEdit || isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={!canEdit || isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      {/* Quarterly targets */}
      <div>
        <p className="text-sm font-medium mb-1">Quarterly targets</p>
        {canEdit && !annualSet && (
          <p className="text-xs text-muted-foreground mb-3">
            Set the annual target first to enable quarterly targets.
          </p>
        )}
        {(!canEdit || annualSet) && <div className="mb-3" />}

        <div className="grid grid-cols-2 gap-3">
          {QUARTERS.map((q) => {
            const qKey = `q${q}` as keyof QuarterlyTargets;
            const initialQValue = qTargets[qKey];
            const quarterDisabled = !canEdit || isPending || !annualSet;

            return (
              <form key={q} action={formAction} className="space-y-1.5">
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="quarter" value={q} />
                <Label
                  htmlFor={`q${q}Target`}
                  className={`text-xs font-medium ${
                    quarterDisabled ? "text-muted-foreground" : ""
                  }`}
                >
                  Q{q} target
                </Label>
                <NumberInput
                  id={`q${q}Target`}
                  name="targetAmount"
                  placeholder={
                    initialTarget !== null
                      ? String(Math.round(initialTarget / 4).toLocaleString("en-US"))
                      : "e.g. 1,250,000"
                  }
                  defaultValue={initialQValue === null ? "" : initialQValue}
                  disabled={quarterDisabled}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={quarterDisabled}
                  className="w-full"
                >
                  Save Q{q}
                </Button>
              </form>
            );
          })}
        </div>
      </div>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          You can view the targets but cannot edit them.
        </p>
      ) : null}
    </div>
  );
}
