"use server";

import {
  approveQuotationApproval,
  fetchQuotations,
  findPendingApprovalForRole,
  parseLeadTimeDays,
  parseSalesMarginPercent,
  rejectQuotationApproval,
  submitQuotationForApproval,
  updateSalesQuotationDetails,
  type RequiredApproverRole,
  type SalesQuotation,
} from "@/lib/sales/quotations";
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
  const normalized = String(role ?? "").trim().toLowerCase();

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
  const normalized = String(role ?? "").trim().toLowerCase();
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
  const normalizedReason = String(reason ?? "").trim().toUpperCase();
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

export async function updateSalesQuotationDetailsAction(
  formData: FormData,
): Promise<ActionResponse<{ quotationId: string }>> {
  try {
    const quotationId = asRequiredString(formData.get("quotationId"), "Quotation");

    const rawMargin = String(formData.get("salesMarginPercent") ?? "").trim();
    const salesMarginPercent = rawMargin === "" ? null : parseSalesMarginPercent(rawMargin);

    const paymentTerms = asOptionalString(formData.get("paymentTerms"))?.toUpperCase() ?? null;

    const rawLeadTime = String(formData.get("leadTimeDays") ?? "").trim();
    const leadTimeDays = rawLeadTime === "" ? null : parseLeadTimeDays(rawLeadTime);

    const notes = asOptionalString(formData.get("notes"))?.toUpperCase() ?? null;

    await updateSalesQuotationDetails({
      quotationId,
      salesMarginPercent,
      paymentTerms,
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
