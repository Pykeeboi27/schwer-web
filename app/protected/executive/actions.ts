"use server";

import { isTargetEditor } from "@/lib/executive/access";
import { upsertAnnualTarget, upsertQuarterlyTarget } from "@/lib/executive/targets";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { revalidatePath } from "next/cache";

export type UpdateAnnualTargetState = {
  success: boolean;
  error: string | null;
  message: string | null;
};

export const INITIAL_UPDATE_TARGET_STATE: UpdateAnnualTargetState = {
  success: false,
  error: null,
  message: null,
};

export async function updateAnnualTargetAction(
  _prevState: UpdateAnnualTargetState,
  formData: FormData,
): Promise<UpdateAnnualTargetState> {
  const yearRaw = String(formData.get("year") ?? "").trim();
  const targetRaw = String(formData.get("targetAmount") ?? "").trim();
  const quarterRaw = String(formData.get("quarter") ?? "").trim();

  const year = Number(yearRaw);
  const targetAmount = Number(targetRaw);

  if (!Number.isInteger(year)) {
    return { success: false, error: "A valid year is required.", message: null };
  }

  if (!Number.isFinite(targetAmount)) {
    return { success: false, error: "Target amount must be a valid number.", message: null };
  }

  const profile = await getCurrentProfile();

  if (!isTargetEditor(profile)) {
    return {
      success: false,
      error: "Only Target Editors can update yearly targets.",
      message: null,
    };
  }

  const quarterNum = quarterRaw ? Number(quarterRaw) : null;
  const isQuarterly =
    quarterNum !== null && Number.isInteger(quarterNum) && quarterNum >= 1 && quarterNum <= 4;

  try {
    if (isQuarterly) {
      await upsertQuarterlyTarget(year, quarterNum as 1 | 2 | 3 | 4, targetAmount);
      revalidatePath("/protected/executive");

      return {
        success: true,
        error: null,
        message: `Q${quarterNum} target updated to ${targetAmount.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`,
      };
    }

    const updatedTarget = await upsertAnnualTarget(year, targetAmount);
    revalidatePath("/protected/executive");

    return {
      success: true,
      error: null,
      message: `Yearly target updated to ${updatedTarget.targetAmount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update target.",
      message: null,
    };
  }
}
