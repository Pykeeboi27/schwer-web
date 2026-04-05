"use server";

import {
  createSalesClient,
  fetchClients,
  parsePaymentNetDays,
  parseSector,
  type SalesClient,
  updateSalesClient,
  validateClientCodeUniqueness,
} from "@/lib/sales/clients";
import { validateClientForm, type ClientFormErrors } from "@/lib/utils/form-validation";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: ClientFormErrors;
};

function asOptionalString(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function asRequiredString(value: FormDataEntryValue | null, fieldName: string): string {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function buildClientNotesPayload(
  contactPerson: string | null,
  email: string | null,
  phone: string | null,
): string | null {
  const notesPayload: Record<string, string> = {};

  if (contactPerson) {
    notesPayload.contactPerson = contactPerson;
  }

  if (email) {
    notesPayload.email = email;
  }

  if (phone) {
    notesPayload.phone = phone;
  }

  if (Object.keys(notesPayload).length === 0) {
    return null;
  }

  return JSON.stringify(notesPayload);
}

export async function createClientAction(
  formData: FormData,
): Promise<ActionResponse<{ clientCode: string }>> {
  try {
    const code = asOptionalString(formData.get("code"));
    const name = asOptionalString(formData.get("name"));
    const contactPerson = asOptionalString(formData.get("contactPerson"));
    const email = asOptionalString(formData.get("email"));
    const phone = asOptionalString(formData.get("phone"));
    const address = asOptionalString(formData.get("address"));
    const sector = asOptionalString(formData.get("sector")) ?? "commercial";

    if (!code) {
      return {
        success: false,
        error: "Client code is required.",
      };
    }

    if (!name) {
      return {
        success: false,
        error: "Client name is required.",
        fieldErrors: {
          name: "Client name is required.",
        },
      };
    }

    const validation = validateClientForm({ name, email, phone, address });
    if (!validation.valid) {
      return {
        success: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.errors,
      };
    }

    const isUnique = await validateClientCodeUniqueness(code);
    if (!isUnique) {
      return {
        success: false,
        error: "Client code already exists. Generate a new one and try again.",
      };
    }

    await createSalesClient({
      clientCode: code,
      companyName: name,
      sector: parseSector(sector),
      paymentTermsDays: 30,
      address,
      notes: buildClientNotesPayload(contactPerson, email, phone),
    });

    revalidatePath("/protected/sales/clients");

    return {
      success: true,
      data: {
        clientCode: code,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create client.",
    };
  }
}

export async function updateClientAction(
  formData: FormData,
): Promise<ActionResponse<{ id: string }>> {
  try {
    const id = asRequiredString(formData.get("id"), "Client id");
    const name = asOptionalString(formData.get("name"));
    const contactPerson = asOptionalString(formData.get("contactPerson"));
    const email = asOptionalString(formData.get("email"));
    const phone = asOptionalString(formData.get("phone"));
    const address = asOptionalString(formData.get("address"));
    const sector = asOptionalString(formData.get("sector")) ?? "commercial";

    if (!name) {
      return {
        success: false,
        error: "Client name is required.",
        fieldErrors: {
          name: "Client name is required.",
        },
      };
    }

    const validation = validateClientForm({ name, email, phone, address });
    if (!validation.valid) {
      return {
        success: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.errors,
      };
    }

    await updateSalesClient({
      id,
      companyName: name,
      sector: parseSector(sector),
      paymentTermsDays: parsePaymentNetDays(formData.get("paymentTermsDays") ?? 30),
      address,
      notes: buildClientNotesPayload(contactPerson, email, phone),
    });

    revalidatePath("/protected/sales/clients");

    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update client.",
    };
  }
}

export async function fetchClientsAction(): Promise<ActionResponse<SalesClient[]>> {
  try {
    const clients = await fetchClients();

    return {
      success: true,
      data: clients,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load clients.",
    };
  }
}
