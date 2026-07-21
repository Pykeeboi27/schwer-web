import { describe, expect, it } from "vitest";

import {
  aggregateQuotationStatus,
  approvalChainForAmount,
  buildApprovalStages,
  firstUnsatisfiedRole,
  nextApproverRole,
  requiredApproverRolesForAmount,
} from "@/lib/sales/quotations";

describe("sales quotation approval rules", () => {
  it("routes required roles by amount threshold, sales_manager -> executive -> owner", () => {
    expect(approvalChainForAmount(2_999_999.99)).toEqual(["sales_manager"]);
    expect(approvalChainForAmount(3_000_000)).toEqual([
      "sales_manager",
      "executive",
      "owner",
    ]);
  });

  it("requiredApproverRolesForAmount stays as a deprecated alias for approvalChainForAmount", () => {
    expect(requiredApproverRolesForAmount(3_000_000)).toEqual(
      approvalChainForAmount(3_000_000),
    );
  });

  it("aggregates statuses to pending/approved/rejected", () => {
    expect(aggregateQuotationStatus(["approved", "approved"])).toBe("approved");
    expect(aggregateQuotationStatus(["approved", "pending"])).toBe("pending");
    expect(aggregateQuotationStatus(["approved", "rejected"])).toBe("rejected");
  });

  describe("nextApproverRole", () => {
    it("advances sequentially for amounts requiring the full chain", () => {
      expect(nextApproverRole("sales_manager", 3_000_000)).toBe("executive");
      expect(nextApproverRole("executive", 3_000_000)).toBe("owner");
      expect(nextApproverRole("owner", 3_000_000)).toBeNull();
    });

    it("terminates after sales_manager below the threshold", () => {
      expect(nextApproverRole("sales_manager", 2_999_999.99)).toBeNull();
    });
  });

  describe("firstUnsatisfiedRole", () => {
    it("returns sales_manager when nothing has approved yet", () => {
      expect(firstUnsatisfiedRole([], 3_000_000)).toBe("sales_manager");
    });

    it("returns the next role in chain order regardless of the order roles approved in", () => {
      // Legacy items approved under the OLD sales_manager -> owner -> executive
      // chain may have owner approved before executive. Under the new chain
      // order, executive is still the first unsatisfied role.
      expect(firstUnsatisfiedRole(["sales_manager", "owner"], 3_000_000)).toBe(
        "executive",
      );
    });

    it("returns null once every chain role has approved", () => {
      expect(
        firstUnsatisfiedRole(["sales_manager", "executive", "owner"], 3_000_000),
      ).toBeNull();
      expect(firstUnsatisfiedRole(["sales_manager"], 2_999_999.99)).toBeNull();
    });
  });

  describe("buildApprovalStages", () => {
    it("marks earlier roles approved, the pending role current, and the rest upcoming", () => {
      expect(
        buildApprovalStages(3_000_000, [
          { role: "sales_manager", status: "approved" },
          { role: "executive", status: "pending" },
        ]),
      ).toEqual([
        { role: "sales_manager", state: "approved" },
        { role: "executive", state: "current" },
        { role: "owner", state: "upcoming" },
      ]);
    });

    it("only has one stage below the 3M threshold", () => {
      expect(
        buildApprovalStages(1_000_000, [{ role: "sales_manager", status: "pending" }]),
      ).toEqual([{ role: "sales_manager", state: "current" }]);
    });
  });
});
