import { describe, expect, it } from "vitest";

import { determineNextQuotationStatus } from "@/lib/sales/approval-workflow";

describe("determineNextQuotationStatus", () => {
  it("routes low-value quotations to approved after sales manager", () => {
    expect(
      determineNextQuotationStatus("pending_sales_manager", "sales_manager", 2_000_000),
    ).toBe("approved");
  });

  it("routes high-value quotations through owner then executive", () => {
    expect(
      determineNextQuotationStatus("pending_sales_manager", "sales_manager", 3_000_000),
    ).toBe("pending_owner");
    expect(determineNextQuotationStatus("pending_owner", "owner", 3_000_000)).toBe(
      "pending_executive",
    );
    expect(
      determineNextQuotationStatus("pending_executive", "executive", 3_000_000),
    ).toBe("approved");
  });

  it("keeps terminal states unchanged", () => {
    expect(determineNextQuotationStatus("approved", "executive", 5_000_000)).toBe(
      "approved",
    );
    expect(determineNextQuotationStatus("rejected", "owner", 5_000_000)).toBe("rejected");
  });

  it("throws when non-assigned role tries to approve", () => {
    expect(() =>
      determineNextQuotationStatus("pending_owner", "sales_manager", 5_000_000),
    ).toThrow(/only owner/i);
  });

  it("normalizes case, whitespace, and the bare 'pending' alias", () => {
    expect(
      determineNextQuotationStatus("Pending  Sales Manager", "sales_manager", 1_000_000),
    ).toBe("approved");
    expect(determineNextQuotationStatus("pending", "sales_manager", 1_000_000)).toBe(
      "approved",
    );
  });

  it("rejects an unsupported status string", () => {
    expect(() =>
      determineNextQuotationStatus("in_limbo", "sales_manager", 1_000_000),
    ).toThrow(/Unsupported quotation status/);
  });

  it("rejects an unsupported approver role", () => {
    expect(() => determineNextQuotationStatus("draft", "accountant", 1_000_000)).toThrow(
      /Unsupported approver role/,
    );
  });

  it("rejects a non-positive or non-finite quotation amount", () => {
    expect(() => determineNextQuotationStatus("draft", "sales_manager", 0)).toThrow(
      /greater than 0/,
    );
    expect(() =>
      determineNextQuotationStatus("draft", "sales_manager", Number.NaN),
    ).toThrow(/greater than 0/);
  });

  it("only allows sales_manager to move a draft into approval", () => {
    expect(() => determineNextQuotationStatus("draft", "owner", 1_000_000)).toThrow(
      /Only sales_manager can move a draft/,
    );
  });

  it("only allows sales_manager to approve at the pending_sales_manager stage", () => {
    expect(() =>
      determineNextQuotationStatus("pending_sales_manager", "owner", 1_000_000),
    ).toThrow(/Only sales_manager can approve this quotation/);
  });

  it("only allows executive to approve at the pending_executive stage", () => {
    expect(() =>
      determineNextQuotationStatus("pending_executive", "owner", 3_000_000),
    ).toThrow(/Only executive can approve this quotation/);
  });

  it("treats closed quotations as terminal", () => {
    expect(determineNextQuotationStatus("closed", "executive", 5_000_000)).toBe("closed");
  });
});
