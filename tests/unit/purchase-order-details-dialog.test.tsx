import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/app/protected/sales/purchase-orders/actions", () => ({
  approvePurchaseOrderAction: vi.fn(),
  createProofOfPaymentSignedUrlAction: vi.fn(),
  deleteCollectionAction: vi.fn(),
  rejectPurchaseOrderAction: vi.fn(),
  resubmitPurchaseOrderAction: vi.fn(),
  updatePurchaseOrderDetailsAction: vi.fn(),
}));

import { PurchaseOrderDetailsDialog } from "@/components/dialogs/purchase-order-details-dialog";
import type { SalesPurchaseOrder } from "@/lib/sales/purchase-orders";

const CURRENT_USER_ID = "u1";

function buildPurchaseOrder(
  overrides: Partial<SalesPurchaseOrder> = {},
  itemOverrides: Partial<SalesPurchaseOrder["items"][number]> = {},
): SalesPurchaseOrder {
  return {
    id: "po1",
    quotationId: "q1",
    poNumber: "PO-0001",
    clientPoNumber: null,
    quotationReference: null,
    clientId: "c1",
    clientName: "Alpha Corp",
    subject: "Cable trays",
    poAmount: 0,
    cost: 1000,
    items: [
      {
        id: "i1",
        description: "Cable tray, 2400mm",
        quantity: 1,
        unitCost: 1000,
        lineTotal: 1000,
        marginPercentage: null,
        marginAmount: null,
        bankPercentage: null,
        bankAmount: null,
        sopPercentage: null,
        sopAmount: null,
        sellingAmount: null,
        ...itemOverrides,
      },
    ],
    marginPercentage: null,
    marginAmount: null,
    bankPercentage: null,
    bankAmount: null,
    sopPercentage: null,
    sopAmount: null,
    sellingAmount: null,
    hasUnequalMargins: false,
    recognizedAmount: 0,
    paymentStatus: "unpaid",
    paymentTerms: null,
    paymentTermsCustom: null,
    leadTimeDays: null,
    salesMarginPercent: null,
    // PO pricing is only editable once rejected -- see isEditable in the dialog.
    status: "rejected",
    pendingApprovalRoles: [],
    approvalStages: [],
    rejectionReason: "Please re-check pricing.",
    rejectedByName: "Owner",
    approvedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    createdBy: CURRENT_USER_ID,
    createdByName: "Meccah Torregoza",
    itemCount: 1,
    ...overrides,
  };
}

describe("PurchaseOrderDetailsDialog sales pricing defaults", () => {
  it("defaults a rejected/unpriced PO's Margin % to 25 while Bank % and SOP % stay blank", async () => {
    const user = userEvent.setup();
    const purchaseOrder = buildPurchaseOrder();

    render(
      <PurchaseOrderDetailsDialog
        open={true}
        onOpenChange={vi.fn()}
        purchaseOrder={purchaseOrder}
        payments={[]}
        currentUserId={CURRENT_USER_ID}
        currentUserRole="sales"
      />,
    );

    // Pricing fields live in the "Pricing" tab, not rendered until selected.
    await user.click(screen.getByRole("tab", { name: "Pricing" }));

    expect((screen.getByLabelText("Margin %") as HTMLInputElement).value).toBe("25");
    expect((screen.getByLabelText("Bank %") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("SOP %") as HTMLInputElement).value).toBe("");
  });

  it("keeps loading a real stored Margin % for an already-priced item instead of overwriting it with 25", async () => {
    const user = userEvent.setup();
    const purchaseOrder = buildPurchaseOrder(
      {},
      {
        marginPercentage: 12,
        marginAmount: 120,
        bankPercentage: 3,
        bankAmount: 30,
        sopPercentage: 2,
        sopAmount: 20,
        sellingAmount: 1200,
      },
    );

    render(
      <PurchaseOrderDetailsDialog
        open={true}
        onOpenChange={vi.fn()}
        purchaseOrder={purchaseOrder}
        payments={[]}
        currentUserId={CURRENT_USER_ID}
        currentUserRole="sales"
      />,
    );

    // Pricing fields live in the "Pricing" tab, not rendered until selected.
    await user.click(screen.getByRole("tab", { name: "Pricing" }));

    expect((screen.getByLabelText("Margin %") as HTMLInputElement).value).toBe("12");
    expect((screen.getByLabelText("Bank %") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("SOP %") as HTMLInputElement).value).toBe("2");
  });
});
