import { describe, expect, it } from "vitest";

import { determineNextQuotationStatus } from "@/lib/sales/approval-workflow";

describe("determineNextQuotationStatus", () => {
  it("routes low-value quotations to approved after sales manager", () => {
    expect(determineNextQuotationStatus("pending_sales_manager", "sales_manager", 2_000_000)).toBe(
      "approved",
    );
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
    expect(determineNextQuotationStatus("approved", "executive", 5_000_000)).toBe("approved");
    expect(determineNextQuotationStatus("rejected", "owner", 5_000_000)).toBe("rejected");
  });

  it("throws when non-assigned role tries to approve", () => {
    expect(() =>
      determineNextQuotationStatus("pending_owner", "sales_manager", 5_000_000),
    ).toThrow(/only owner/i);
  });
});
