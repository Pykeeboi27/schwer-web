import { describe, expect, it } from "vitest";

import { determineNextQuotationStatus } from "@/lib/sales/approval-workflow";

describe("quotation approval workflow", () => {
  it("routes draft quotations to sales-manager approval", () => {
    expect(determineNextQuotationStatus("draft", "sales_manager", 1_500_000)).toBe(
      "pending_sales_manager",
    );
  });

  it("finalizes low-value quotations after sales-manager approval", () => {
    expect(
      determineNextQuotationStatus(
        "pending_sales_manager",
        "sales_manager",
        2_999_999.99,
      ),
    ).toBe("approved");
  });

  it("routes high-value quotations through owner then executive", () => {
    expect(determineNextQuotationStatus("pending_sales_manager", "sales_manager", 3_000_000)).toBe(
      "pending_owner",
    );
    expect(determineNextQuotationStatus("pending_owner", "owner", 3_000_000)).toBe(
      "pending_executive",
    );
    expect(determineNextQuotationStatus("pending_executive", "executive", 3_000_000)).toBe(
      "approved",
    );
  });

  it("keeps terminal states unchanged", () => {
    expect(determineNextQuotationStatus("approved", "executive", 5_000_000)).toBe(
      "approved",
    );
    expect(determineNextQuotationStatus("rejected", "owner", 5_000_000)).toBe(
      "rejected",
    );
  });

  it("throws when an unauthorized role attempts approval", () => {
    expect(() =>
      determineNextQuotationStatus("pending_owner", "sales_manager", 4_200_000),
    ).toThrow(/only owner/i);
  });
});