import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addPoPaymentAction,
  createPurchaseOrderAction,
} from "@/app/protected/sales/actions";

const { mockCreatePurchaseOrder, mockAddPoPayment } = vi.hoisted(() => ({
  mockCreatePurchaseOrder: vi.fn(),
  mockAddPoPayment: vi.fn(),
}));

vi.mock("@/lib/sales/purchase-orders", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/purchase-orders")>(
    "@/lib/sales/purchase-orders",
  );

  return {
    ...actual,
    createPurchaseOrder: mockCreatePurchaseOrder,
    addPoPayment: mockAddPoPayment,
  };
});

describe("sales purchase-order actions", () => {
  beforeEach(() => {
    mockCreatePurchaseOrder.mockReset();
    mockAddPoPayment.mockReset();
  });

  it("creates purchase orders through server action", async () => {
    mockCreatePurchaseOrder.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("clientId", "client-1");
    formData.set("subject", "Transformer package");
    formData.set("poAmount", "2500000");
    formData.set("paymentTermsDays", "30");

    await expect(createPurchaseOrderAction(formData)).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(mockCreatePurchaseOrder).toHaveBeenCalled();
  });

  it("adds PO payments through server action", async () => {
    mockAddPoPayment.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("poId", "po-1");
    formData.set("amountCollected", "500000");

    await expect(addPoPaymentAction(formData)).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(mockAddPoPayment).toHaveBeenCalled();
  });
});
