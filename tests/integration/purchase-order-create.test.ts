import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPurchaseOrderAction } from "@/app/protected/sales/purchase-orders/actions";

const { mockCreatePurchaseOrder, mockGenerateNextPoNumber } = vi.hoisted(() => ({
  mockCreatePurchaseOrder: vi.fn(),
  mockGenerateNextPoNumber: vi.fn(),
}));

vi.mock("@/lib/sales/purchase-orders", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/purchase-orders")>(
    "@/lib/sales/purchase-orders",
  );

  return {
    ...actual,
    createPurchaseOrder: mockCreatePurchaseOrder,
    generateNextPoNumber: mockGenerateNextPoNumber,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("createPurchaseOrderAction", () => {
  beforeEach(() => {
    mockCreatePurchaseOrder.mockReset();
    mockGenerateNextPoNumber.mockReset();
  });

  it("generates PO number when none is provided", async () => {
    mockGenerateNextPoNumber.mockResolvedValue("PO-SALES-2026-0001");
    mockCreatePurchaseOrder.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("clientId", "client-1");
    formData.set("subject", "Industrial power package");
    formData.set("totalAmount", "1500000");
    formData.set("paymentTermsDays", "30");

    const response = await createPurchaseOrderAction(formData);

    expect(response).toMatchObject({
      success: true,
      data: { poNumber: "PO-SALES-2026-0001" },
    });
    expect(mockCreatePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        poNumber: "PO-SALES-2026-0001",
      }),
    );
  });

  it("uses manually entered PO number when provided", async () => {
    mockCreatePurchaseOrder.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("clientId", "client-2");
    formData.set("subject", "Solar package");
    formData.set("poNumber", "PO-SALES-2026-0099");
    formData.set("totalAmount", "2500000");
    formData.set("paymentTermsDays", "45");

    const response = await createPurchaseOrderAction(formData);

    expect(response.success).toBe(true);
    expect(mockGenerateNextPoNumber).not.toHaveBeenCalled();
    expect(mockCreatePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        poNumber: "PO-SALES-2026-0099",
      }),
    );
  });
});