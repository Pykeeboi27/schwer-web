"use server";

import {
  addPoPayment,
  approvePoApproval,
  fetchPurchaseOrders,
  findPendingPoApprovalForRole,
  parsePoAmount,
  rejectPoApproval,
  resubmitPurchaseOrderForApproval,
  type SalesPurchaseOrder,
} from "@/lib/sales/purchase-orders";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type RequiredApproverRole = "sales_manager" | "owner" | "executive";

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

export async function updatePurchaseOrderReferencesAction(
  poId: string,
  clientPoNumber: string | null,
  quotationReference: string | null,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedId = String(poId ?? "").trim();
  if (!normalizedId) {
    return { success: false, error: "Purchase order id is required." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        client_po_number: clientPoNumber ? clientPoNumber.toUpperCase() : null,
        quotation_reference: quotationReference ? quotationReference.toUpperCase() : null,
      })
      .eq("id", normalizedId);

    if (error) throw new Error(error.message);

    revalidatePath("/protected/sales/purchase-orders");
    return { success: true, data: { poId: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update purchase order references.",
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
