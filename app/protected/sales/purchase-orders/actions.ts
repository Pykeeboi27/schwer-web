"use server";

import {
  addPoPayment,
  approvePoApproval,
  deletePoPayment,
  fetchPurchaseOrders,
  findPendingPoApprovalForRole,
  parsePoAmount,
  rejectPoApproval,
  resubmitPurchaseOrderForApproval,
  updatePoPayment,
  updatePurchaseOrderDetails,
  type SalesPurchaseOrder,
} from "@/lib/sales/purchase-orders";
import { parseLeadTimeDays, parsePercentInput } from "@/lib/sales/quotations";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type RequiredApproverRole = "sales_manager" | "owner" | "executive";

function asOptionalString(value: string | null | undefined): string | null {
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

export async function recordCollectionAction(
  purchaseOrderId: string,
  amount: number,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPoId = String(purchaseOrderId ?? "").trim();

  if (!normalizedPoId) {
    return {
      success: false,
      error: "Purchase order id is required.",
    };
  }

  try {
    const normalizedAmount = parsePoAmount(amount);

    await addPoPayment({
      purchaseOrderId: normalizedPoId,
      amountCollected: normalizedAmount,
    });

    revalidatePath("/protected/sales/purchase-orders");

    return {
      success: true,
      data: { poId: normalizedPoId },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record collection.",
    };
  }
}

export async function updateCollectionAction(
  paymentId: string,
  purchaseOrderId: string,
  amount: number,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPaymentId = String(paymentId ?? "").trim();
  const normalizedPoId = String(purchaseOrderId ?? "").trim();

  if (!normalizedPaymentId) {
    return { success: false, error: "Collection id is required." };
  }
  if (!normalizedPoId) {
    return { success: false, error: "Purchase order id is required." };
  }

  try {
    const normalizedAmount = parsePoAmount(amount);

    await updatePoPayment({
      paymentId: normalizedPaymentId,
      purchaseOrderId: normalizedPoId,
      amountCollected: normalizedAmount,
    });

    revalidatePath("/protected/sales/purchase-orders");

    return { success: true, data: { poId: normalizedPoId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update collection.",
    };
  }
}

export async function deleteCollectionAction(
  paymentId: string,
  purchaseOrderId: string,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPaymentId = String(paymentId ?? "").trim();
  const normalizedPoId = String(purchaseOrderId ?? "").trim();

  if (!normalizedPaymentId) {
    return { success: false, error: "Collection id is required." };
  }
  if (!normalizedPoId) {
    return { success: false, error: "Purchase order id is required." };
  }

  try {
    await deletePoPayment({
      paymentId: normalizedPaymentId,
      purchaseOrderId: normalizedPoId,
    });

    revalidatePath("/protected/sales/purchase-orders");

    return { success: true, data: { poId: normalizedPoId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete collection.",
    };
  }
}

export async function approvePurchaseOrderAction(
  poId: string,
  userRole: string,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPoId = String(poId ?? "").trim();
  const role = normalizeRole(userRole);

  if (!normalizedPoId) {
    return { success: false, error: "Purchase order id is required." };
  }
  if (!role) {
    return { success: false, error: "A valid approver role is required." };
  }

  try {
    const pending = await findPendingPoApprovalForRole({ poId: normalizedPoId, role });
    if (!pending) {
      return { success: false, error: "No pending PO approval was found for your role." };
    }

    await approvePoApproval({ poId: normalizedPoId, approvalId: pending.approvalId });
    revalidatePath("/protected/sales/purchase-orders");
    revalidatePath("/protected/executive/approvals");

    return { success: true, data: { poId: normalizedPoId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve purchase order.",
    };
  }
}

export async function rejectPurchaseOrderAction(
  poId: string,
  reason: string,
  userRole: string,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPoId = String(poId ?? "").trim();
  const normalizedReason = String(reason ?? "")
    .trim()
    .toUpperCase();
  const role = normalizeRole(userRole);

  if (!normalizedPoId) {
    return { success: false, error: "Purchase order id is required." };
  }
  if (!normalizedReason) {
    return { success: false, error: "Rejection reason is required." };
  }
  if (!role) {
    return { success: false, error: "A valid approver role is required." };
  }

  try {
    const pending = await findPendingPoApprovalForRole({ poId: normalizedPoId, role });
    if (!pending) {
      return { success: false, error: "No pending PO approval was found for your role." };
    }

    await rejectPoApproval({
      poId: normalizedPoId,
      approvalId: pending.approvalId,
      reason: normalizedReason,
    });
    revalidatePath("/protected/sales/purchase-orders");
    revalidatePath("/protected/executive/approvals");

    return { success: true, data: { poId: normalizedPoId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject purchase order.",
    };
  }
}

export async function resubmitPurchaseOrderAction(
  poId: string,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedId = String(poId ?? "").trim();
  if (!normalizedId) {
    return { success: false, error: "Purchase order id is required." };
  }
  try {
    await resubmitPurchaseOrderForApproval(normalizedId);
    revalidatePath("/protected/sales/purchase-orders");
    revalidatePath("/protected/executive/approvals");
    return { success: true, data: { poId: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to resubmit purchase order.",
    };
  }
}

export type PurchaseOrderItemPricingFormInput = {
  id: string;
  marginPercentage: string;
  bankPercentage: string;
  sopPercentage: string;
};

export type PurchaseOrderDetailsInput = {
  hasUnequalMargins: boolean;
  items: PurchaseOrderItemPricingFormInput[];
  paymentTerms: string;
  paymentTermsCustom: string;
  leadTimeDays: string;
  clientPoNumber: string;
  quotationReference: string;
};

/**
 * Re-prices a rejected PO per line item (margin/bank/sop %, lead time,
 * payment terms) and updates its references. Only permitted while the PO is
 * `rejected`.
 */
export async function updatePurchaseOrderDetailsAction(
  poId: string,
  input: PurchaseOrderDetailsInput,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedId = String(poId ?? "").trim();
  if (!normalizedId) {
    return { success: false, error: "Purchase order id is required." };
  }

  try {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("At least one priced line item is required.");
    }

    const parsePercent = (raw: string, label: string): number | null => {
      const normalized = String(raw ?? "").trim();
      return normalized === "" ? null : parsePercentInput(normalized, label);
    };

    const items = input.items.map((item) => {
      const id = String(item.id ?? "").trim();
      if (!id) {
        throw new Error("Line item pricing was malformed.");
      }
      return {
        id,
        marginPercentage: parsePercent(item.marginPercentage, "Margin percentage"),
        bankPercentage: parsePercent(item.bankPercentage, "Bank percentage"),
        sopPercentage: parsePercent(item.sopPercentage, "SOP percentage"),
      };
    });

    const rawLeadTime = String(input.leadTimeDays ?? "").trim();
    const leadTimeDays = rawLeadTime === "" ? null : parseLeadTimeDays(rawLeadTime);

    const paymentTerms = asOptionalString(input.paymentTerms);
    const paymentTermsCustom =
      paymentTerms === "Other"
        ? (asOptionalString(input.paymentTermsCustom)?.toUpperCase() ?? null)
        : null;

    await updatePurchaseOrderDetails({
      purchaseOrderId: normalizedId,
      hasUnequalMargins: Boolean(input.hasUnequalMargins),
      items,
      paymentTerms,
      paymentTermsCustom,
      leadTimeDays,
      clientPoNumber: asOptionalString(input.clientPoNumber),
      quotationReference: asOptionalString(input.quotationReference),
    });

    revalidatePath("/protected/sales/purchase-orders");
    return { success: true, data: { poId: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update purchase order details.",
    };
  }
}

export async function fetchPurchaseOrdersAction(
  departmentId?: string,
): Promise<ActionResponse<SalesPurchaseOrder[]>> {
  try {
    const purchaseOrders = await fetchPurchaseOrders(departmentId);

    return {
      success: true,
      data: purchaseOrders,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load purchase orders.",
    };
  }
}
