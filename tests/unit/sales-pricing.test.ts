import { describe, expect, it } from "vitest";

import {
  computeAggregatePricing,
  computeSalesPricing,
  computeVatBreakdown,
  type SalesPricing,
} from "@/lib/sales/pricing";

describe("computeSalesPricing", () => {
  it("derives margin/bank/sop and a pre-VAT selling amount from percentages", () => {
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

describe("computeAggregatePricing", () => {
  it("sums per-item pre-VAT amounts and derives blended weighted-average percentages", () => {
    const itemA = {
      directCost: 1000,
      ...computeSalesPricing({
        directCost: 1000,
        marginPercentage: 10,
        bankPercentage: 5,
        sopPercentage: 2,
      }),
    };
    const itemB = {
      directCost: 500,
      ...computeSalesPricing({
        directCost: 500,
        marginPercentage: 20,
        bankPercentage: 0,
        sopPercentage: 0,
      }),
    };

    const result = computeAggregatePricing([itemA, itemB]);

    expect(result).toEqual({
      directCost: 1500,
      marginAmount: 200,
      bankAmount: 50,
      sopAmount: 20,
      sellingAmount: 1770,
      marginPercentage: 13.33,
      bankPercentage: 3.33,
      sopPercentage: 1.33,
    });
  });

  it("returns an all-zero result for an empty item list (divide-by-zero guard)", () => {
    expect(computeAggregatePricing([])).toEqual({
      directCost: 0,
      marginAmount: 0,
      bankAmount: 0,
      sopAmount: 0,
      sellingAmount: 0,
      marginPercentage: 0,
      bankPercentage: 0,
      sopPercentage: 0,
    });
  });

  it("treats non-finite item fields as zero contributions", () => {
    const result = computeAggregatePricing([
      {
        directCost: Number.NaN,
        marginAmount: Number.NaN,
        bankAmount: 10,
        sopAmount: 5,
        sellingAmount: Number.NaN,
      },
      {
        directCost: 1000,
        marginAmount: 100,
        bankAmount: 0,
        sopAmount: 0,
        sellingAmount: 1100,
      },
    ]);

    expect(result).toEqual({
      directCost: 1000,
      marginAmount: 100,
      bankAmount: 10,
      sopAmount: 5,
      sellingAmount: 1100,
      marginPercentage: 10,
      bankPercentage: 1,
      sopPercentage: 0.5,
    });
  });
});

describe("computeVatBreakdown", () => {
  it("applies 12% VAT once, off the aggregate, and sums the grand total", () => {
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
