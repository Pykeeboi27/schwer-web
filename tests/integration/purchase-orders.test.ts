import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPurchaseOrdersAction } from "@/app/protected/sales/purchase-orders/actions";

const { mockFetchPurchaseOrders } = vi.hoisted(() => ({
  mockFetchPurchaseOrders: vi.fn(),
}));

vi.mock("@/lib/sales/purchase-orders", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/purchase-orders")>(
    "@/lib/sales/purchase-orders",
  );

  return {
    ...actual,
    fetchPurchaseOrders: mockFetchPurchaseOrders,
  };
});

describe("fetchPurchaseOrdersAction", () => {
  beforeEach(() => {
    mockFetchPurchaseOrders.mockReset();
  });

  it("returns approved quotations as purchase orders for the active department", async () => {
    mockFetchPurchaseOrders.mockResolvedValue([
      {
        id: "quotation-1",
        quotationId: "quotation-1",
        poNumber: "Q-SALES-2026-0001",
        clientId: "client-1",
        clientName: "ACME Industrial",
        subject: "Main electrical package",
        poAmount: 1_000_000,
        cost: 600_000,
        recognizedAmount: 200_000,
        paymentStatus: "partial",
        paymentTerms: "Net 30",
        leadTimeDays: 45,
        salesMarginPercent: 40,
        approvedAt: "2026-04-05T10:00:00Z",
      },
    ]);

    const response = await fetchPurchaseOrdersAction("sales-dept");

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.data?.[0].poNumber).toBe("Q-SALES-2026-0001");
  });
});
