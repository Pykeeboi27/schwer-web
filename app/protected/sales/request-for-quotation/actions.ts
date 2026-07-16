"use server";

import {
  createRequestForQuotation,
  listRequestsForQuotation,
  type RequestForQuotation,
} from "@/lib/sales/quotations";
import { revalidatePath } from "next/cache";

type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type CreateRequestForQuotationInput = {
  quotationNumber: string;
  clientId: string;
  subject: string;
  notes: string | null;
  items: Array<{ description: string; quantity: number }>;
};

export async function createRequestForQuotationAction(
  input: CreateRequestForQuotationInput,
): Promise<ActionResponse<{ quotationId: string }>> {
  try {
    const result = await createRequestForQuotation(input);
    revalidatePath("/protected/sales/request-for-quotation");
    revalidatePath("/protected/engineering/quotations");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create the request for quotation.",
    };
  }
}

export async function fetchRequestsForQuotationAction(): Promise<
  ActionResponse<RequestForQuotation[]>
> {
  try {
    const requests = await listRequestsForQuotation();
    return { success: true, data: requests };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load requests for quotation.",
    };
  }
}
