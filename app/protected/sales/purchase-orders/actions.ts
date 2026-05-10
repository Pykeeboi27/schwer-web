"use server";

import {
  addPoPayment,
  fetchPurchaseOrders,
  parsePoAmount,
  type SalesPurchaseOrder,
} from "@/lib/sales/purchase-orders";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function recordCollectionAction(
  poId: string,
  amount: number,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPoId = String(poId ?? "").trim();

  if (!normalizedPoId) {
    return {
      success: false,
      error: "Purchase order id is required.",
    };
  }

  try {
    const normalizedAmount = parsePoAmount(amount);

    await addPoPayment({
      poId: normalizedPoId,
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
