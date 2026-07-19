"use server";

import {
  deleteCostingQuotation,
  isHttpUrl,
  parseUnitCost,
  setQuotationItemCosts,
  submitCostingForApproval,
} from "@/lib/engineering/costing-quotations";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function ensureValidDriveLink(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Google Drive link is required.");
  }
  if (!isHttpUrl(normalized)) {
    throw new Error("Google Drive link must be a valid http or https URL.");
  }
  return normalized;
}

export type SetQuotationItemCostsInput = {
  quotationId: string;
  quotationNumber?: string;
  clientId: string;
  subject: string;
  items: Array<{ id: string; unitCost: string | number | null }>;
  googleDriveLink: string;
  notes?: string | null;
  salesPersonId?: string | null;
};

export async function setQuotationItemCostsAction(
  input: SetQuotationItemCostsInput,
): Promise<ActionResponse<{ quotationId: string }>> {
  try {
    const googleDriveLink = ensureValidDriveLink(input.googleDriveLink);
    const items = input.items.map((item) => ({
      id: item.id,
      unitCost:
        item.unitCost === null || item.unitCost === ""
          ? null
          : parseUnitCost(item.unitCost),
    }));

    await setQuotationItemCosts({
      quotationId: input.quotationId,
      quotationNumber: input.quotationNumber?.trim() || undefined,
      clientId: input.clientId,
      subject: input.subject,
      items,
      googleDriveLink,
      notes: input.notes ?? null,
      salesPersonId: input.salesPersonId ?? null,
    });

    revalidatePath("/protected/engineering/quotations");
    return { success: true, data: { quotationId: input.quotationId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update costing quotation.",
    };
  }
}

export async function submitCostingForApprovalAction(
  quotationId: string,
): Promise<ActionResponse<{ quotationId: string }>> {
  const normalized = String(quotationId ?? "").trim();
  if (!normalized) {
    return { success: false, error: "Quotation id is required." };
  }

  try {
    await submitCostingForApproval(normalized);
    revalidatePath("/protected/engineering/quotations");
    revalidatePath("/protected/executive/costing-approvals");
    return { success: true, data: { quotationId: normalized } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to submit for costing approval.",
    };
  }
}

export async function deleteCostingQuotationAction(
  quotationId: string,
): Promise<ActionResponse<{ quotationId: string }>> {
  const normalized = String(quotationId ?? "").trim();
  if (!normalized) {
    return { success: false, error: "Quotation id is required." };
  }

  try {
    await deleteCostingQuotation(normalized);
    revalidatePath("/protected/engineering/quotations");
    return { success: true, data: { quotationId: normalized } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete costing quotation.",
    };
  }
}
