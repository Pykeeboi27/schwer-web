import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitQuotationAction } from "@/app/protected/sales/actions";

const { mockSubmitQuotationForApproval } = vi.hoisted(() => ({
  mockSubmitQuotationForApproval: vi.fn(),
}));

vi.mock("@/lib/sales/quotations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/quotations")>(
    "@/lib/sales/quotations",
  );

  return {
    ...actual,
    submitQuotationForApproval: mockSubmitQuotationForApproval,
  };
});

describe("sales quotations server actions", () => {
  beforeEach(() => {
    mockSubmitQuotationForApproval.mockReset();
  });

  it("submits quotation and delegates approval-row creation flow", async () => {
    mockSubmitQuotationForApproval.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("quotationId", "quote-1");

    await expect(submitQuotationAction(formData)).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(mockSubmitQuotationForApproval).toHaveBeenCalledWith("quote-1");
  });

  it("returns actionable error when submission fails", async () => {
    mockSubmitQuotationForApproval.mockRejectedValue(new Error("No active approver found for role: owner."));

    const formData = new FormData();
    formData.set("quotationId", "quote-1");

    await expect(submitQuotationAction(formData)).resolves.toEqual({
      ok: false,
      error: "No active approver found for role: owner.",
    });
  });
});
