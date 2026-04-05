import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveQuotationAction,
  rejectQuotationAction,
  submitQuotationForApprovalAction,
} from "@/app/protected/sales/quotations/actions";

const {
  mockSubmitQuotationForApproval,
  mockFindPendingApprovalForRole,
  mockApproveQuotationApproval,
  mockRejectQuotationApproval,
} = vi.hoisted(() => ({
  mockSubmitQuotationForApproval: vi.fn(),
  mockFindPendingApprovalForRole: vi.fn(),
  mockApproveQuotationApproval: vi.fn(),
  mockRejectQuotationApproval: vi.fn(),
}));

vi.mock("@/lib/sales/quotations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/quotations")>(
    "@/lib/sales/quotations",
  );

  return {
    ...actual,
    submitQuotationForApproval: mockSubmitQuotationForApproval,
    findPendingApprovalForRole: mockFindPendingApprovalForRole,
    approveQuotationApproval: mockApproveQuotationApproval,
    rejectQuotationApproval: mockRejectQuotationApproval,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("quotation approval actions", () => {
  beforeEach(() => {
    mockSubmitQuotationForApproval.mockReset();
    mockFindPendingApprovalForRole.mockReset();
    mockApproveQuotationApproval.mockReset();
    mockRejectQuotationApproval.mockReset();
  });

  it("submits quotations for approval", async () => {
    mockSubmitQuotationForApproval.mockResolvedValue(undefined);

    const response = await submitQuotationForApprovalAction("quote-1");

    expect(response).toMatchObject({ success: true });
    expect(mockSubmitQuotationForApproval).toHaveBeenCalledWith("quote-1");
  });

  it("approves quotations when pending assignment exists", async () => {
    mockFindPendingApprovalForRole.mockResolvedValue({ approvalId: "approval-1" });
    mockApproveQuotationApproval.mockResolvedValue(undefined);

    const response = await approveQuotationAction("quote-1", "sales_manager");

    expect(response).toMatchObject({ success: true });
    expect(mockFindPendingApprovalForRole).toHaveBeenCalledWith({
      quotationId: "quote-1",
      role: "sales_manager",
    });
    expect(mockApproveQuotationApproval).toHaveBeenCalledWith({
      approvalId: "approval-1",
    });
  });

  it("returns actionable error when approval assignment is missing", async () => {
    mockFindPendingApprovalForRole.mockResolvedValue(null);

    const response = await approveQuotationAction("quote-1", "owner");

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/no pending approval assignment/i);
  });

  it("rejects quotations with reason", async () => {
    mockFindPendingApprovalForRole.mockResolvedValue({ approvalId: "approval-1" });
    mockRejectQuotationApproval.mockResolvedValue(undefined);

    const response = await rejectQuotationAction(
      "quote-1",
      "Commercial terms are incomplete",
      "owner",
    );

    expect(response).toMatchObject({ success: true });
    expect(mockRejectQuotationApproval).toHaveBeenCalledWith({
      approvalId: "approval-1",
      reason: "Commercial terms are incomplete",
    });
  });
});