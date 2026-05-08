"use server";

import {
  createCostingQuotation,
  deleteCostingQuotation,
  isHttpUrl,
  parseCostingAmount,
  parseCostingCost,
  submitCostingForApproval,
  updateCostingQuotation,
} from "@/lib/engineering/costing-quotations";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function asRequiredString(value: FormDataEntryValue | null, fieldName: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function ensureValidDriveLink(value: FormDataEntryValue | null): string {
  const normalized = asRequiredString(value, "Google Drive link");
  if (!isHttpUrl(normalized)) {
    throw new Error("Google Drive link must be a valid http or https URL.");
  }
  return normalized;
}

export async function createCostingQuotationAction(
  formData: FormData,
): Promise<ActionResponse<{ quotationId: string }>> {
  try {
    const clientId = asRequiredString(formData.get("clientId"), "Client");
    const subject = asRequiredString(formData.get("subject"), "Subject");
    const amount = parseCostingAmount(formData.get("amount"));
    const cost = parseCostingCost(formData.get("cost"));
    const googleDriveLink = ensureValidDriveLink(formData.get("googleDriveLink"));
    const notes = asOptionalString(formData.get("notes"));

    const result = await createCostingQuotation({
      clientId,
      subject,
      amount,
      cost,
      googleDriveLink,
      notes,
    });

    revalidatePath("/protected/engineering/quotations");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create costing quotation.",
    };
  }
}

export async function updateCostingQuotationAction(
  formData: FormData,
): Promise<ActionResponse<{ quotationId: string }>> {
  try {
    const quotationId = asRequiredString(formData.get("quotationId"), "Quotation");
    const clientId = asRequiredString(formData.get("clientId"), "Client");
    const subject = asRequiredString(formData.get("subject"), "Subject");
    const amount = parseCostingAmount(formData.get("amount"));
    const cost = parseCostingCost(formData.get("cost"));
    const googleDriveLink = ensureValidDriveLink(formData.get("googleDriveLink"));
    const notes = asOptionalString(formData.get("notes"));

    await updateCostingQuotation({
      quotationId,
      clientId,
      subject,
      amount,
      cost,
      googleDriveLink,
      notes,
    });

    revalidatePath("/protected/engineering/quotations");
    return { success: true, data: { quotationId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update costing quotation.",
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
      error: error instanceof Error ? error.message : "Failed to submit for costing approval.",
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
      error: error instanceof Error ? error.message : "Failed to delete costing quotation.",
    };
  }
}
