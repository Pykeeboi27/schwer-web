"use client";

import {
  INITIAL_UPDATE_TARGET_STATE,
  updateAnnualTargetAction,
} from "@/app/protected/executive/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/utils/toast-notification";
import { useActionState, useEffect } from "react";

type TargetEditorFormProps = {
  year: number;
  initialTarget: number | null;
  canEdit: boolean;
};

export function TargetEditorForm({ year, initialTarget, canEdit }: TargetEditorFormProps) {
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

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="year" value={year} />
      <div className="space-y-1">
        <Label htmlFor="targetAmount">Yearly target amount</Label>
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
      </div>

      <Button type="submit" disabled={!canEdit || isPending}>
        {isPending ? "Saving..." : "Save target"}
      </Button>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          You can view the target but cannot edit it.
        </p>
      ) : null}
    </form>
  );
}
