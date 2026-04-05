import { describe, expect, it } from "vitest";

import {
  buildPaymentTermsNotes,
  parseOptionalDownpaymentPercent,
  parsePaymentNetDays,
  parseSector,
} from "@/lib/sales/clients";

describe("sales client validation", () => {
  it("validates net days and sector", () => {
    expect(parsePaymentNetDays("30")).toBe(30);
    expect(parseSector("industrial")).toBe("industrial");
  });

  it("rejects invalid net days and downpayment percent", () => {
    expect(() => parsePaymentNetDays("-1")).toThrow();
    expect(() => parseOptionalDownpaymentPercent("120")).toThrow();
  });

  it("maps optional payment terms extras into notes JSON", () => {
    expect(
      buildPaymentTermsNotes({
        downpaymentPercent: 10,
        notes: "net 30 with deposit",
      }),
    ).toBe('{"downpaymentPercent":10,"notes":"net 30 with deposit"}');

    expect(buildPaymentTermsNotes({ downpaymentPercent: null, notes: "" })).toBeNull();
  });
});
