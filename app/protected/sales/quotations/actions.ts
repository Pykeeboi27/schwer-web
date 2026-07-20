"use server";

import {
  approveQuotationApproval,
  fetchQuotations,
  findPendingApprovalForRole,
  parseLeadTimeDays,
  parsePercentInput,
  rejectQuotationApproval,
  resubmitQuotationForApproval,
  submitQuotationForApproval,
  updateSalesQuotationDetails,
  type RequiredApproverRole,
  type SalesQuotation,
  type SalesQuotationItemPricingInput,
} from "@/lib/sales/quotations";
import {
  convertQuotationToPurchaseOrder,
  markClientPoReceived,
} from "@/lib/sales/purchase-orders";
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

function normalizeRole(role: string | undefined): RequiredApproverRole | null {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "sales_manager" ||
    normalized === "owner" ||
    normalized === "executive"
  ) {
    return normalized;
  }

  return null;
}

function shouldRestrictToHighValue(role: string | undefined): boolean {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();
  return normalized === "owner" || normalized === "executive";
}

export async function submitQuotationForApprovalAction(
  quotationId: string,
): Promise<ActionResponse<{ quotationId: string }>> {
  const normalizedQuotationId = String(quotationId ?? "").trim();

  if (!normalizedQuotationId) {
    return {
      success: false,
      error: "Quotation id is required.",
    };
  }

  try {
    await submitQuotationForApproval(normalizedQuotationId);
    revalidatePath("/protected/sales/quotations");
    revalidatePath("/protected/executive/approvals");

    return {
      success: true,
      data: { quotationId: normalizedQuotationId },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to submit quotation for approval.",
    };
  }
}

export async function approveQuotationAction(
  quotationId: string,
  userRole: string,
): Promise<ActionResponse<{ quotationId: string; role: RequiredApproverRole }>> {
  const normalizedQuotationId = String(quotationId ?? "").trim();
  const role = normalizeRole(userRole);

  if (!normalizedQuotationId) {
    return {
      success: false,
      error: "Quotation id is required.",
    };
  }

  if (!role) {
    return {
      success: false,
      error: "A valid approver role is required.",
    };
  }

  try {
    const pendingApproval = await findPendingApprovalForRole({
      quotationId: normalizedQuotationId,
      role,
    });

    if (!pendingApproval) {
      return {
        success: false,
        error: "No pending approval assignment was found for your role.",
      };
    }

    await approveQuotationApproval({ approvalId: pendingApproval.approvalId });
    revalidatePath("/protected/sales/quotations");
    revalidatePath("/protected/executive/approvals");

    return {
      success: true,
      data: {
        quotationId: normalizedQuotationId,
        role,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve quotation.",
    };
  }
}

export async function rejectQuotationAction(
  quotationId: string,
  reason: string,
  userRole: string,
): Promise<ActionResponse<{ quotationId: string; role: RequiredApproverRole }>> {
  const normalizedQuotationId = String(quotationId ?? "").trim();
  const normalizedReason = String(reason ?? "")
    .trim()
    .toUpperCase();
  const role = normalizeRole(userRole);

  if (!normalizedQuotationId) {
    return {
      success: false,
      error: "Quotation id is required.",
    };
  }

  if (!normalizedReason) {
    return {
      success: false,
      error: "Rejection reason is required.",
    };
  }

  if (!role) {
    return {
      success: false,
      error: "A valid approver role is required.",
    };
  }

  try {
    const pendingApproval = await findPendingApprovalForRole({
      quotationId: normalizedQuotationId,
      role,
    });

    if (!pendingApproval) {
      return {
        success: false,
        error: "No pending approval assignment was found for your role.",
      };
    }

    await rejectQuotationApproval({
      approvalId: pendingApproval.approvalId,
      reason: normalizedReason,
    });
    revalidatePath("/protected/sales/quotations");
    revalidatePath("/protected/executive/approvals");

    return {
      success: true,
      data: {
        quotationId: normalizedQuotationId,
        role,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject quotation.",
    };
  }
}

export async function fetchQuotationsAction(
  departmentId?: string,
  userRole?: string,
): Promise<ActionResponse<SalesQuotation[]>> {
  try {
    const quotations = await fetchQuotations(departmentId);
    const filteredQuotations = shouldRestrictToHighValue(userRole)
      ? quotations.filter((quotation) => quotation.amount >= 3_000_000)
      : quotations;

    return {
      success: true,
      data: filteredQuotations,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load quotations.",
    };
  }
}

export async function markClientPoReceivedAction(
  quotationId: string,
  clientPoNumber: string,
): Promise<ActionResponse<{ quotationId: string }>> {
  const normalizedId = String(quotationId ?? "").trim();
  const normalizedPo = String(clientPoNumber ?? "")
    .trim()
    .toUpperCase();

  if (!normalizedId) {
    return { success: false, error: "Quotation id is required." };
  }
  if (!normalizedPo) {
    return { success: false, error: "Client PO number is required." };
  }

  try {
    await markClientPoReceived({
      quotationId: normalizedId,
      clientPoNumber: normalizedPo,
    });
    revalidatePath("/protected/sales/quotations");
    return { success: true, data: { quotationId: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record the client PO.",
    };
  }
}

export async function convertToPurchaseOrderAction(
  quotationId: string,
): Promise<ActionResponse<{ purchaseOrderId: string }>> {
  const normalizedId = String(quotationId ?? "").trim();

  if (!normalizedId) {
    return { success: false, error: "Quotation id is required." };
  }

  try {
    const result = await convertQuotationToPurchaseOrder(normalizedId);
    revalidatePath("/protected/sales/quotations");
    revalidatePath("/protected/sales/purchase-orders");
    revalidatePath("/protected/executive/approvals");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to convert to purchase order.",
    };
  }
}

export async function resubmitQuotationAction(
  quotationId: string,
): Promise<ActionResponse<{ quotationId: string }>> {
  const normalizedId = String(quotationId ?? "").trim();

  if (!normalizedId) {
    return { success: false, error: "Quotation id is required." };
  }

  try {
    await resubmitQuotationForApproval(normalizedId);
    revalidatePath("/protected/sales/quotations");
    return { success: true, data: { quotationId: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resubmit quotation.",
    };
  }
}

/**
 * Parses the per-item pricing payload sent by the quotation/PO pricing
 * dialogs: a JSON array of `{ id, marginPercentage, bankPercentage,
 * sopPercentage }`, each percentage either a number or null (unset).
 */
function parseItemPricingPayload(raw: FormDataEntryValue | null): SalesQuotationItemPricingInput[] {
  const normalized = String(raw ?? "").trim();
  if (!normalized) {
    throw new Error("At least one priced line item is required.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("Line item pricing was malformed.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("At least one priced line item is required.");
  }

  return parsed.map((entry) => {
    if (typeof entry !== "object" || entry === null || !("id" in entry)) {
      throw new Error("Line item pricing was malformed.");
    }
    const record = entry as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    if (!id) {
      throw new Error("Line item pricing was malformed.");
    }

    const parsePercent = (value: unknown, label: string): number | null =>
      value === null || value === undefined || value === ""
        ? null
        : parsePercentInput(value, label);

    return {
      id,
      marginPercentage: parsePercent(record.marginPercentage, "Margin percentage"),
      bankPercentage: parsePercent(record.bankPercentage, "Bank percentage"),
      sopPercentage: parsePercent(record.sopPercentage, "SOP percentage"),
    };
  });
}

export async function updateSalesQuotationDetailsAction(
  formData: FormData,
): Promise<ActionResponse<{ quotationId: string }>> {
  try {
    const quotationId = asRequiredString(formData.get("quotationId"), "Quotation");

    const items = parseItemPricingPayload(formData.get("items"));
    const hasUnequalMargins = String(formData.get("hasUnequalMargins") ?? "") === "true";

    const googleDriveLink = asOptionalString(formData.get("googleDriveLink"));

    const paymentTermsRaw = asOptionalString(formData.get("paymentTerms"));
    // Predefined options are stored verbatim; only the custom value is uppercased.
    const paymentTerms = paymentTermsRaw;
    const paymentTermsCustom =
      paymentTermsRaw === "Other"
        ? (asOptionalString(formData.get("paymentTermsCustom"))?.toUpperCase() ?? null)
        : null;

    const rawLeadTime = String(formData.get("leadTimeDays") ?? "").trim();
    const leadTimeDays = rawLeadTime === "" ? null : parseLeadTimeDays(rawLeadTime);

    const notes = asOptionalString(formData.get("notes"))?.toUpperCase() ?? null;

    await updateSalesQuotationDetails({
      quotationId,
      hasUnequalMargins,
      items,
      googleDriveLink,
      paymentTerms,
      paymentTermsCustom,
      leadTimeDays,
      notes,
    });

    revalidatePath("/protected/sales/quotations");

    return {
      success: true,
      data: { quotationId },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update sales details.",
    };
  }
}
