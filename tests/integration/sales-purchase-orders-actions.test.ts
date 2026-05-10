import { beforeEach, describe, expect, it, vi } from "vitest";

import { addPoPaymentAction } from "@/app/protected/sales/actions";

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

describe("sales purchase-order actions", () => {
  beforeEach(() => {
    mockAddPoPayment.mockReset();
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
