import { describe, expect, it } from "vitest";

import {
  computeSalesPricing,
  computeVatBreakdown,
  type SalesPricing,
} from "@/lib/sales/pricing";

describe("computeSalesPricing", () => {
  it("derives margin/bank/sop and selling amounts from percentages", () => {
    const result = computeSalesPricing({
      directCost: 1000,
      marginPercentage: 10,
      bankPercentage: 5,
      sopPercentage: 2,
    });

    expect(result).toEqual({
      marginAmount: 100,
      bankAmount: 50,
      sopAmount: 20,
      sellingAmount: 1170,
    });
  });

  it("rounds every amount to two decimals", () => {
    const result = computeSalesPricing({
      directCost: 333.33,
      marginPercentage: 7.5,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    // 333.33 * 7.5 / 100 = 24.99975 -> 25.00
    expect(result.marginAmount).toBe(25);
    expect(result.sellingAmount).toBe(358.33);
  });

  it("treats a non-finite direct cost as zero", () => {
    const result = computeSalesPricing({
      directCost: Number.NaN,
      marginPercentage: 10,
      bankPercentage: 10,
      sopPercentage: 10,
    });

    expect(result).toEqual({
      marginAmount: 0,
      bankAmount: 0,
      sopAmount: 0,
      sellingAmount: 0,
    });
  });

  it("defaults NaN percentages to zero without affecting the selling price", () => {
    const result = computeSalesPricing({
      directCost: 500,
      marginPercentage: Number.NaN,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.marginAmount).toBe(0);
    expect(result.sellingAmount).toBe(500);
  });
});

describe("computeVatBreakdown", () => {
  it("applies 12% VAT to each component and sums the grand total", () => {
    const pricing: SalesPricing = {
      marginAmount: 100,
      bankAmount: 50,
      sopAmount: 20,
      sellingAmount: 1170,
    };

    expect(computeVatBreakdown(pricing)).toEqual({
      marginVat: 12,
      bankVat: 6,
      sopVat: 2.4,
      grandTotal: 1190.4,
    });
  });

  it("returns zeroed VAT when there are no taxable components", () => {
    const pricing: SalesPricing = {
      marginAmount: 0,
      bankAmount: 0,
      sopAmount: 0,
      sellingAmount: 800,
    };

    expect(computeVatBreakdown(pricing)).toEqual({
      marginVat: 0,
      bankVat: 0,
      sopVat: 0,
      grandTotal: 800,
    });
  });
});
