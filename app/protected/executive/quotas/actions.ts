"use server";

import { isTargetEditor } from "@/lib/executive/access";
import { upsertSalesQuota } from "@/lib/executive/quotas";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import type { UpdateSalesQuotaState } from "./quota-state";
import { revalidatePath } from "next/cache";

export async function updateSalesQuotaAction(
  _prevState: UpdateSalesQuotaState,
  formData: FormData,
): Promise<UpdateSalesQuotaState> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const quotaRaw = String(formData.get("quotaAmount") ?? "").trim();

  const year = Number(yearRaw);
  const quotaAmount = Number(quotaRaw);

  if (!profileId) {
    return { success: false, error: "A salesperson is required.", message: null };
  }

  if (!Number.isInteger(year)) {
    return {
      success: false,
      error: "A valid year is required.",
      message: null,
    };
  }

  if (!Number.isFinite(quotaAmount)) {
    return {
      success: false,
      error: "Quota amount must be a valid number.",
      message: null,
    };
  }

  const profile = await getCurrentProfile();

  if (!isTargetEditor(profile)) {
    return {
      success: false,
      error: "Only Target Editors can update sales quotas.",
      message: null,
    };
  }

  try {
    await upsertSalesQuota(profileId, year, quotaAmount);
    revalidatePath("/protected/executive/quotas");
    revalidatePath("/protected/sales");

    return {
      success: true,
      error: null,
      message: "Quota saved.",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update sales quota.",
      message: null,
    };
  }
}
