"use server";

import {
  approveCostingQuotation,
  rejectCostingQuotation,
} from "@/lib/executive/costing-approvals";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function revalidateAffectedPaths(): void {
  revalidatePath("/protected/executive/costing-approvals");
  revalidatePath("/protected/engineering/quotations");
  revalidatePath("/protected/sales/quotations");
}

export async function approveCostingQuotationAction(
  quotationId: string,
): Promise<ActionResponse<{ quotationId: string }>> {
  const normalized = String(quotationId ?? "").trim();
  if (!normalized) {
    return { success: false, error: "Quotation id is required." };
  }

  try {
    await approveCostingQuotation(normalized);
    revalidateAffectedPaths();
    return { success: true, data: { quotationId: normalized } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve costing quotation.",
    };
  }
}

export async function rejectCostingQuotationAction(
  quotationId: string,
  reason: string,
): Promise<ActionResponse<{ quotationId: string }>> {
  const normalizedId = String(quotationId ?? "").trim();
  const normalizedReason = String(reason ?? "").trim().toUpperCase();

  if (!normalizedId) {
    return { success: false, error: "Quotation id is required." };
  }
  if (!normalizedReason) {
    return { success: false, error: "Rejection reason is required." };
  }

  try {
    await rejectCostingQuotation({ quotationId: normalizedId, reason: normalizedReason });
    revalidateAffectedPaths();
    return { success: true, data: { quotationId: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject costing quotation.",
    };
  }
}
