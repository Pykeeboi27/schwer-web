import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createQuotationDraftAction,
  deleteQuotationDraftAction,
  updateQuotationDraftAction,
} from "@/app/protected/sales/quotations/actions";

const {
  mockCreateQuotationDraft,
  mockUpdateQuotationDraft,
  mockDeleteQuotationDraft,
} = vi.hoisted(() => ({
  mockCreateQuotationDraft: vi.fn(),
  mockUpdateQuotationDraft: vi.fn(),
  mockDeleteQuotationDraft: vi.fn(),
}));

vi.mock("@/lib/sales/quotations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/quotations")>(
    "@/lib/sales/quotations",
  );

  return {
    ...actual,
    createQuotationDraft: mockCreateQuotationDraft,
    updateQuotationDraft: mockUpdateQuotationDraft,
    deleteQuotationDraft: mockDeleteQuotationDraft,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("createQuotationDraftAction", () => {
  beforeEach(() => {
    mockCreateQuotationDraft.mockReset();
    mockUpdateQuotationDraft.mockReset();
    mockDeleteQuotationDraft.mockReset();
  });

  it("creates a quotation draft for sales users", async () => {
    mockCreateQuotationDraft.mockResolvedValue({ quotationId: "quote-1" });

    const formData = new FormData();
    formData.set("clientId", "client-1");
    formData.set("subject", "Switchgear package");
    formData.set("amount", "1200000");
    formData.set("cost", "850000");
    formData.set("notes", "Target submission this week");

    const response = await createQuotationDraftAction(formData);

    expect(response).toMatchObject({
      success: true,
      data: { quotationId: "quote-1" },
    });
    expect(mockCreateQuotationDraft).toHaveBeenCalledWith({
      clientId: "client-1",
      subject: "Switchgear package",
      amount: 1200000,
      cost: 850000,
      notes: "Target submission this week",
    });
  });

  it("returns an actionable validation error when client is missing", async () => {
    const formData = new FormData();
    formData.set("subject", "Switchgear package");
    formData.set("amount", "1200000");

    const response = await createQuotationDraftAction(formData);

    expect(response.success).toBe(false);
    expect(response.error).toBe("Client is required.");
    expect(mockCreateQuotationDraft).not.toHaveBeenCalled();
  });

  it("surfaces service errors from draft creation", async () => {
    mockCreateQuotationDraft.mockRejectedValue(new Error("Failed to create quotation draft."));

    const formData = new FormData();
    formData.set("clientId", "client-1");
    formData.set("subject", "Switchgear package");
    formData.set("amount", "1200000");

    const response = await createQuotationDraftAction(formData);

    expect(response.success).toBe(false);
    expect(response.error).toBe("Failed to create quotation draft.");
  });

  it("updates a draft quotation", async () => {
    mockUpdateQuotationDraft.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("quotationId", "quote-1");
    formData.set("clientId", "client-2");
    formData.set("subject", "Updated switchgear package");
    formData.set("amount", "2100000");
    formData.set("cost", "1500000");
    formData.set("notes", "Updated delivery scope");

    const response = await updateQuotationDraftAction(formData);

    expect(response).toMatchObject({
      success: true,
      data: { quotationId: "quote-1" },
    });
    expect(mockUpdateQuotationDraft).toHaveBeenCalledWith({
      quotationId: "quote-1",
      clientId: "client-2",
      subject: "Updated switchgear package",
      amount: 2100000,
      cost: 1500000,
      notes: "Updated delivery scope",
    });
  });

  it("deletes a draft quotation", async () => {
    mockDeleteQuotationDraft.mockResolvedValue(undefined);

    const response = await deleteQuotationDraftAction("quote-1");

    expect(response).toMatchObject({
      success: true,
      data: { quotationId: "quote-1" },
    });
    expect(mockDeleteQuotationDraft).toHaveBeenCalledWith("quote-1");
  });
});
