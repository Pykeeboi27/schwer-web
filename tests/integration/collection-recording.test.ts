import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordCollectionAction } from "@/app/protected/sales/purchase-orders/actions";

const { mockAddPoPayment } = vi.hoisted(() => ({
  mockAddPoPayment: vi.fn(),
}));

vi.mock("@/lib/sales/purchase-orders", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/purchase-orders")>(
    "@/lib/sales/purchase-orders",
  );

  return {
    ...actual,
    addPoPayment: mockAddPoPayment,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("recordCollectionAction", () => {
  beforeEach(() => {
    mockAddPoPayment.mockReset();
  });

  it("records collection when amount is valid", async () => {
    mockAddPoPayment.mockResolvedValue(undefined);

    const response = await recordCollectionAction("po-1", 500000);

    expect(response).toMatchObject({ success: true });
    expect(mockAddPoPayment).toHaveBeenCalledWith({
      poId: "po-1",
      amountCollected: 500000,
    });
  });

  it("rejects collection that exceeds remaining PO balance", async () => {
    mockAddPoPayment.mockRejectedValue(
      new Error("Collected amount cannot exceed the PO amount."),
    );

    const response = await recordCollectionAction("po-1", 500000);

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/cannot exceed/i);
  });

  it("validates collection amount is positive", async () => {
    const response = await recordCollectionAction("po-1", 0);

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/greater than 0/i);
  });
});