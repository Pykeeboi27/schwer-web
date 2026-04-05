"use server";

import {
  addClientContact,
  buildPaymentTermsNotes,
  createSalesClient,
  inactivateSalesClient,
  parseOptionalDownpaymentPercent,
  parsePaymentNetDays,
  parseSector,
  setClientPrimaryContact,
  updateSalesClient,
} from "@/lib/sales/clients";
import {
  approveQuotationApproval,
  createQuotationDraft,
  parseQuotationAmount,
  rejectQuotationApproval,
  submitQuotationForApproval,
} from "@/lib/sales/quotations";
import {
  addPoPayment,
  createPurchaseOrder,
  parsePoAmount,
} from "@/lib/sales/purchase-orders";

export type SalesActionResult = {
  ok: boolean;
  error: string | null;
};

function actionFailure(error: unknown, fallback: string): SalesActionResult {
  return {
    ok: false,
    error: error instanceof Error && error.message ? error.message : fallback,
  };
}

function getRequiredString(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

export async function createClientAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const clientCode = getRequiredString(formData, "clientCode");
    const companyName = getRequiredString(formData, "companyName");
    const sector = parseSector(formData.get("sector"));
    const paymentTermsDays = parsePaymentNetDays(formData.get("paymentTermsDays"));
    const downpaymentPercent = parseOptionalDownpaymentPercent(formData.get("downpaymentPercent"));
    const notes = buildPaymentTermsNotes({
      downpaymentPercent,
      notes: String(formData.get("paymentTermsNotes") ?? "").trim(),
    });

    await createSalesClient({
      clientCode,
      companyName,
      sector,
      paymentTermsDays,
      notes,
    });

    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to create client.");
  }
}

export async function updateClientAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const id = getRequiredString(formData, "id");
    const companyName = getRequiredString(formData, "companyName");
    const sector = parseSector(formData.get("sector"));
    const paymentTermsDays = parsePaymentNetDays(formData.get("paymentTermsDays"));
    const downpaymentPercent = parseOptionalDownpaymentPercent(formData.get("downpaymentPercent"));
    const notes = buildPaymentTermsNotes({
      downpaymentPercent,
      notes: String(formData.get("paymentTermsNotes") ?? "").trim(),
    });

    await updateSalesClient({
      id,
      companyName,
      sector,
      paymentTermsDays,
      notes,
    });

    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to update client.");
  }
}

export async function inactivateClientAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const id = getRequiredString(formData, "id");
    await inactivateSalesClient(id);
    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to inactivate client.");
  }
}

export async function addClientContactAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const clientId = getRequiredString(formData, "clientId");
    const fullName = getRequiredString(formData, "fullName");
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const mobile = String(formData.get("mobile") ?? "").trim() || null;
    const position = String(formData.get("position") ?? "").trim() || null;
    const isPrimary = String(formData.get("isPrimary") ?? "") === "on";

    await addClientContact({
      clientId,
      fullName,
      email,
      phone,
      mobile,
      position,
      isPrimary,
    });

    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to create contact.");
  }
}

export async function setPrimaryContactAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const clientId = getRequiredString(formData, "clientId");
    const contactId = getRequiredString(formData, "contactId");
    await setClientPrimaryContact({ clientId, contactId });
    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to set primary contact.");
  }
}

export async function createQuotationDraftAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const clientId = getRequiredString(formData, "clientId");
    const subject = getRequiredString(formData, "subject");
    const amount = parseQuotationAmount(formData.get("amount"));
    const costRaw = String(formData.get("cost") ?? "").trim();
    const cost = costRaw ? Number(costRaw) : null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    await createQuotationDraft({
      clientId,
      subject,
      amount,
      cost,
      notes,
    });

    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to create quotation draft.");
  }
}

export async function submitQuotationAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const quotationId = getRequiredString(formData, "quotationId");
    await submitQuotationForApproval(quotationId);
    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to submit quotation.");
  }
}

export async function approveQuotationAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const approvalId = getRequiredString(formData, "approvalId");
    const note = String(formData.get("note") ?? "").trim() || null;
    await approveQuotationApproval({ approvalId, note });
    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to approve quotation.");
  }
}

export async function rejectQuotationAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const approvalId = getRequiredString(formData, "approvalId");
    const reason = getRequiredString(formData, "reason");
    await rejectQuotationApproval({ approvalId, reason });
    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to reject quotation.");
  }
}

export async function createPurchaseOrderAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const clientId = getRequiredString(formData, "clientId");
    const subject = getRequiredString(formData, "subject");
    const poAmount = parsePoAmount(formData.get("poAmount"));
    const paymentTermsDays = parsePaymentNetDays(formData.get("paymentTermsDays"));
    const costRaw = String(formData.get("cost") ?? "").trim();
    const cost = costRaw ? Number(costRaw) : null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    await createPurchaseOrder({
      clientId,
      subject,
      poAmount,
      cost,
      paymentTermsDays,
      notes,
    });

    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to create purchase order.");
  }
}

export async function addPoPaymentAction(formData: FormData): Promise<SalesActionResult> {
  try {
    const poId = getRequiredString(formData, "poId");
    const amountCollected = parsePoAmount(formData.get("amountCollected"));
    const paymentDate = String(formData.get("paymentDate") ?? "").trim() || null;
    const paymentMethod = String(formData.get("paymentMethod") ?? "").trim() || null;
    const referenceNumber = String(formData.get("referenceNumber") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    await addPoPayment({
      poId,
      amountCollected,
      paymentDate,
      paymentMethod,
      referenceNumber,
      notes,
    });

    return { ok: true, error: null };
  } catch (error) {
    return actionFailure(error, "Failed to add PO payment.");
  }
}
