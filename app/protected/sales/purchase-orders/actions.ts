"use server";

import {
  addPoPayment,
  createPurchaseOrder,
  fetchPurchaseOrders,
  generateNextPoNumber,
  parsePoAmount,
  type SalesPurchaseOrder,
} from "@/lib/sales/purchase-orders";
import { parsePaymentNetDays } from "@/lib/sales/clients";
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

export async function createPurchaseOrderAction(
  formData: FormData,
): Promise<ActionResponse<{ poNumber: string }>> {
  try {
    const clientId = asRequiredString(formData.get("clientId"), "Client");
    const subject = asRequiredString(formData.get("subject"), "Subject");
    const poAmount = parsePoAmount(formData.get("totalAmount"));
    const paymentTermsDays = parsePaymentNetDays(formData.get("paymentTermsDays") ?? 30);
    const notes = asOptionalString(formData.get("notes"));

    const enteredPoNumber = asOptionalString(formData.get("poNumber"));
    const poNumber = enteredPoNumber ?? (await generateNextPoNumber("SALES"));

    await createPurchaseOrder({
      clientId,
      subject,
      poAmount,
      paymentTermsDays,
      poNumber,
      notes,
    });

    revalidatePath("/protected/sales/purchase-orders");

    return {
      success: true,
      data: { poNumber },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create purchase order.",
    };
  }
}

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