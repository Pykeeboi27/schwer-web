import { describe, expect, it } from "vitest";

import {
  aggregateQuotationStatus,
  requiredApproverRolesForAmount,
} from "@/lib/sales/quotations";

describe("sales quotation approval rules", () => {
  it("routes required roles by amount threshold", () => {
    expect(requiredApproverRolesForAmount(2_999_999.99)).toEqual(["sales_manager"]);
    expect(requiredApproverRolesForAmount(3_000_000)).toEqual([
      "sales_manager",
      "owner",
      "executive",
    ]);
  });

  it("aggregates statuses to pending/approved/rejected", () => {
    expect(aggregateQuotationStatus(["approved", "approved"])).toBe("approved");
    expect(aggregateQuotationStatus(["approved", "pending"])).toBe("pending");
    expect(aggregateQuotationStatus(["approved", "rejected"])).toBe("rejected");
  });
});
