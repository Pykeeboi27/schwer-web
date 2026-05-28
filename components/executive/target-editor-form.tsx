"use client";

import {
  INITIAL_UPDATE_TARGET_STATE,
  updateAnnualTargetAction,
} from "@/app/protected/executive/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="year" value={year} />
        <Label htmlFor="targetAmount">Annual target</Label>
        <div className="flex gap-2">
          <Input
            id="targetAmount"
            name="targetAmount"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={initialTarget === null ? "" : String(initialTarget)}
            disabled={!canEdit || isPending}
          />
          <Button type="submit" disabled={!canEdit || isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3">
        {QUARTERS.map((q) => {
          const qKey = `q${q}` as keyof QuarterlyTargets;
          const initialQValue = qTargets[qKey];

          return (
            <form key={q} action={formAction} className="space-y-1">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="quarter" value={q} />
              <Label htmlFor={`q${q}Target`} className="text-xs">
                Q{q} target
              </Label>
              <Input
                id={`q${q}Target`}
                name="targetAmount"
                type="number"
                step="0.01"
                min={0}
                placeholder={
                  initialTarget !== null
                    ? String(Math.round(initialTarget / 4))
                    : undefined
                }
                defaultValue={initialQValue === null ? "" : String(initialQValue)}
                disabled={!canEdit || isPending}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!canEdit || isPending}
                className="w-full"
              >
                Save Q{q}
              </Button>
            </form>
          );
        })}
      </div>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          You can view the targets but cannot edit them.
        </p>
      ) : null}
    </div>
  );
}
