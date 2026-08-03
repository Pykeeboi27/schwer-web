"use server";

import {
  addPoPayment,
  approvePoApproval,
  deleteEncodedPurchaseOrder,
  deletePoPayment,
  encodeExistingPurchaseOrder,
  fetchPurchaseOrders,
  findPendingPoApprovalForRole,
  parsePoAmount,
  rejectPoApproval,
  resubmitPurchaseOrderForApproval,
  updatePoPayment,
  updatePurchaseOrderDetails,
  type SalesPurchaseOrder,
} from "@/lib/sales/purchase-orders";
import { createProofOfPaymentSignedUrl } from "@/lib/sales/proof-of-payment-server";
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
  proofPath: string,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPoId = String(purchaseOrderId ?? "").trim();
  const normalizedProofPath = String(proofPath ?? "").trim();

  if (!normalizedPoId) {
    return {
      success: false,
      error: "Purchase order id is required.",
    };
  }
  if (!normalizedProofPath) {
    return {
      success: false,
      error: "Proof of payment is required.",
    };
  }

  try {
    const normalizedAmount = parsePoAmount(amount);

    await addPoPayment({
      purchaseOrderId: normalizedPoId,
      amountCollected: normalizedAmount,
      proofPath: normalizedProofPath,
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
  proofPath?: string,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedPaymentId = String(paymentId ?? "").trim();
  const normalizedPoId = String(purchaseOrderId ?? "").trim();
  const normalizedProofPath = String(proofPath ?? "").trim();

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
      ...(normalizedProofPath ? { proofPath: normalizedProofPath } : {}),
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

/** Mints a short-lived signed URL to view a collection's proof-of-payment image. */
export async function createProofOfPaymentSignedUrlAction(
  proofPath: string,
): Promise<ActionResponse<{ url: string }>> {
  const normalizedPath = String(proofPath ?? "").trim();
  if (!normalizedPath) {
    return { success: false, error: "Proof of payment path is required." };
  }

  try {
    const url = await createProofOfPaymentSignedUrl(normalizedPath);
    return { success: true, data: { url } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load proof of payment.",
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

export type EncodeExistingPoItemFormInput = {
  description: string;
  quantity: string;
  rawCost: string;
  marginPercentage: string;
  bankPercentage: string;
  sopPercentage: string;
};

export type EncodeExistingPoPaymentFormInput = {
  amountCollected: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
  /** Storage path of the already-uploaded proof-of-payment image. */
  proofPath: string;
};

export type EncodeExistingPurchaseOrderFormInput = {
  poNumber: string;
  clientId: string;
  salesPersonId: string;
  subject: string;
  clientPoNumber: string;
  quotationReference: string;
  poDate: string;
  paymentTerms: string;
  paymentTermsCustom: string;
  leadTimeDays: string;
  hasUnequalMargins: boolean;
  items: EncodeExistingPoItemFormInput[];
  payments: EncodeExistingPoPaymentFormInput[];
};

/**
 * Existing Purchase Order Encoding: records an already-existing, already-won
 * PO for record-keeping, with no approval workflow. See
 * lib/sales/purchase-orders.ts encodeExistingPurchaseOrder for the pricing
 * and write-transaction details.
 */
export async function encodeExistingPurchaseOrderAction(
  input: EncodeExistingPurchaseOrderFormInput,
): Promise<ActionResponse<{ purchaseOrderId: string }>> {
  try {
    const poNumber = String(input.poNumber ?? "")
      .trim()
      .toUpperCase();
    if (!poNumber) {
      throw new Error("PO number is required.");
    }

    const clientId = String(input.clientId ?? "").trim();
    if (!clientId) {
      throw new Error("Client is required.");
    }

    const salesPersonId = String(input.salesPersonId ?? "").trim();
    if (!salesPersonId) {
      throw new Error("Sales person is required.");
    }

    const subject = String(input.subject ?? "").trim();
    if (!subject) {
      throw new Error("Subject is required.");
    }

    const poDate = String(input.poDate ?? "").trim();
    if (!poDate) {
      throw new Error("PO date is required.");
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("Add at least one line item.");
    }

    const items = input.items.map((item, index) => {
      const description = String(item.description ?? "")
        .trim()
        .toUpperCase();
      if (!description) {
        throw new Error(`Item ${index + 1} needs a description.`);
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Item ${index + 1} needs a quantity greater than 0.`);
      }

      const rawCost = Number(item.rawCost);
      if (!Number.isFinite(rawCost) || rawCost <= 0) {
        throw new Error(`Item ${index + 1} needs a raw cost greater than 0.`);
      }

      const marginRaw = String(item.marginPercentage ?? "").trim();
      if (!marginRaw) {
        throw new Error(`Item ${index + 1} needs a margin percentage.`);
      }

      return {
        description,
        quantity,
        rawCost,
        marginPercentage: parsePercentInput(marginRaw, "Margin percentage"),
        bankPercentage: parsePercentInput(item.bankPercentage || "0", "Bank percentage"),
        sopPercentage: parsePercentInput(item.sopPercentage || "0", "SOP percentage"),
      };
    });

    const leadTimeDays = parseLeadTimeDays(input.leadTimeDays);

    const paymentTerms = asOptionalString(input.paymentTerms);
    if (!paymentTerms) {
      throw new Error("Payment terms are required.");
    }
    const paymentTermsCustom =
      paymentTerms === "Other"
        ? (asOptionalString(input.paymentTermsCustom)?.toUpperCase() ?? null)
        : null;

    const payments = (Array.isArray(input.payments) ? input.payments : []).map(
      (payment, index) => {
        const amountCollected = Number(payment.amountCollected);
        if (!Number.isFinite(amountCollected) || amountCollected <= 0) {
          throw new Error(`Payment ${index + 1} needs an amount greater than 0.`);
        }

        const paymentDate = String(payment.paymentDate ?? "").trim();
        if (!paymentDate) {
          throw new Error(`Payment ${index + 1} needs a date.`);
        }

        const proofPath = String(payment.proofPath ?? "").trim();
        if (!proofPath) {
          throw new Error(`Payment ${index + 1} needs a proof-of-payment photo.`);
        }

        return {
          amountCollected,
          paymentDate,
          paymentMethod: asOptionalString(payment.paymentMethod),
          referenceNumber: asOptionalString(payment.referenceNumber),
          notes: asOptionalString(payment.notes)?.toUpperCase() ?? null,
          proofPath,
        };
      },
    );

    const result = await encodeExistingPurchaseOrder({
      poNumber,
      clientId,
      salesPersonId,
      subject: subject.toUpperCase(),
      clientPoNumber: asOptionalString(input.clientPoNumber),
      quotationReference:
        asOptionalString(input.quotationReference)?.toUpperCase() ?? null,
      poDate,
      paymentTerms,
      paymentTermsCustom,
      leadTimeDays,
      hasUnequalMargins: Boolean(input.hasUnequalMargins),
      items,
      payments,
    });

    revalidatePath("/protected/sales/purchase-orders");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to record the purchase order.",
    };
  }
}

/** Deletes a manually-encoded PO so it can be re-entered after a mistake. */
export async function deleteEncodedPurchaseOrderAction(
  purchaseOrderId: string,
): Promise<ActionResponse<{ poId: string }>> {
  const normalizedId = String(purchaseOrderId ?? "").trim();
  if (!normalizedId) {
    return { success: false, error: "Purchase order id is required." };
  }

  try {
    await deleteEncodedPurchaseOrder(normalizedId);
    revalidatePath("/protected/sales/purchase-orders");
    return { success: true, data: { poId: normalizedId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete the purchase order.",
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
