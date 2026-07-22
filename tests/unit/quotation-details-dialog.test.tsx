import { render, screen } from "@testing-library/react";
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

vi.mock("@/app/protected/sales/quotations/actions", () => ({
  approveQuotationAction: vi.fn(),
  convertToPurchaseOrderAction: vi.fn(),
  markClientPoReceivedAction: vi.fn(),
  rejectQuotationAction: vi.fn(),
  resubmitQuotationAction: vi.fn(),
  submitQuotationForApprovalAction: vi.fn(),
  updateSalesQuotationDetailsAction: vi.fn(),
}));

import { QuotationDetailsDialog } from "@/components/dialogs/quotation-details-dialog";
import type { SalesQuotation } from "@/lib/sales/quotations";

const CURRENT_USER_ID = "u1";

function buildQuotation(
  overrides: Partial<SalesQuotation> = {},
  itemOverrides: Partial<SalesQuotation["items"][number]> = {},
): SalesQuotation {
  return {
    id: "q1",
    quotationNumber: "QTN-0001",
    clientId: "c1",
    clientName: "Alpha Corp",
    subject: "Cable trays",
    amount: 0,
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
    googleDriveLink: null,
    notes: null,
    status: "draft",
    preparedBy: CURRENT_USER_ID,
    preparedByName: "Meccah Torregoza",
    salesPersonId: CURRENT_USER_ID,
    salesPersonName: "Meccah Torregoza",
    pendingApprovalRoles: [],
    approvalStages: [],
    rejectionReason: null,
    rejectedByName: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    costingApprovedAt: null,
    salesMarginPercent: null,
    marginPercentage: null,
    marginAmount: null,
    bankPercentage: null,
    bankAmount: null,
    sopPercentage: null,
    sopAmount: null,
    sellingAmount: null,
    hasUnequalMargins: false,
    paymentTerms: null,
    paymentTermsCustom: null,
    leadTimeDays: null,
    clientPoNumber: null,
    clientConfirmedAt: null,
    convertedPoId: null,
    convertedPoStatus: null,
    poConvertedAt: null,
    ...overrides,
  };
}

describe("QuotationDetailsDialog sales pricing defaults", () => {
  it("defaults a fresh/unpriced draft's Margin % to 25 while Bank % and SOP % stay blank", () => {
    const quotation = buildQuotation();

    render(
      <QuotationDetailsDialog
        open={true}
        onOpenChange={vi.fn()}
        quotation={quotation}
        currentUserId={CURRENT_USER_ID}
        currentUserRole="sales"
      />,
    );

    expect((screen.getByLabelText("Margin %") as HTMLInputElement).value).toBe("25");
    expect((screen.getByLabelText("Bank %") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("SOP %") as HTMLInputElement).value).toBe("");
  });

  it("keeps loading a real stored Margin % for an already-priced item instead of overwriting it with 25", () => {
    const quotation = buildQuotation(
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
      <QuotationDetailsDialog
        open={true}
        onOpenChange={vi.fn()}
        quotation={quotation}
        currentUserId={CURRENT_USER_ID}
        currentUserRole="sales"
      />,
    );

    expect((screen.getByLabelText("Margin %") as HTMLInputElement).value).toBe("12");
    expect((screen.getByLabelText("Bank %") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("SOP %") as HTMLInputElement).value).toBe("2");
  });
});
