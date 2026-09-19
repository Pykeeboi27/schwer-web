import { describe, expect, it } from "vitest";

import {
  computeAggregatePricing,
  computeSalesPricing,
  computeVatBreakdown,
  repriceStoredItems,
  round2,
  type SalesPricingAmounts,
} from "@/lib/sales/pricing";

describe("computeSalesPricing", () => {
  it("treats margin% as gross margin on the selling price, then compounds bank% and sop% on top", () => {
    const result = computeSalesPricing({
      directCost: 1000,
      quantity: 1,
      marginPercentage: 10,
      bankPercentage: 5,
      sopPercentage: 2,
    });

    // Selling = 1000 / (1 - 0.10) = 1111.111... -> margin = 111.11
    // Bank = 1111.111... * 0.05 = 55.555... (on top of cost+margin)
    // Sop  = (1111.111... + 55.555...) * 0.02 = 23.333... (on top of cost+margin+bank)
    // Selling amount is the exact total, not rounded up to the nearest 100: 1190.00
    expect(result).toEqual({
      marginAmount: 111.11,
      bankAmount: 55.56,
      sopAmount: 23.33,
      sellingAmount: 1190,
      unitCost: 1000,
      unitSellingAmount: 1190,
    });
  });

  it("scales the per-unit price by quantity, using directCost/quantity as the unit cost", () => {
    const result = computeSalesPricing({
      directCost: 3333.33 * 30,
      quantity: 30,
      marginPercentage: 25,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    // Unit cost = 3333.33; Selling = 3333.33 / 0.75 = 4444.44 (exact, no
    // rounding up), then scaled back up by the 30 quantity.
    expect(result.unitSellingAmount).toBe(4444.44);
    expect(result.sellingAmount).toBe(133333.2);
    expect(result.marginAmount).toBe(33333.3);
  });

  it("rounds the per-unit selling price to the centavo before scaling by quantity, so unit price x qty reconciles with a per-unit costing sheet", () => {
    // Unit cost = 3333.33 / 3 = 1111.11; unit selling = 1111.11 / 0.85 =
    // 1307.1882... -> rounds to 1307.19. The OLD behavior (round only the
    // line total) gave 3921.56 here -- one centavo short of 1307.19 * 3.
    const result = computeSalesPricing({
      directCost: 3333.33,
      quantity: 3,
      marginPercentage: 15,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.unitSellingAmount).toBe(1307.19);
    expect(result.sellingAmount).toBe(3921.57);
    expect(result.marginAmount).toBe(588.24);
    expect(round2(result.unitSellingAmount * 3)).toBe(result.sellingAmount);
  });

  it("guarantees unitSellingAmount * quantity === sellingAmount exactly across awkward cost/qty/percentage combinations", () => {
    const quantities = [3, 7, 11, 13];
    const costs = [1000.33, 285000.67, 12345.01];
    const percentageSets: Array<[number, number, number]> = [
      [15, 0, 0],
      [10, 5, 2],
      [33.33, 7, 0.25],
    ];

    for (const quantity of quantities) {
      for (const cost of costs) {
        for (const [marginPercentage, bankPercentage, sopPercentage] of percentageSets) {
          const result = computeSalesPricing({
            directCost: cost,
            quantity,
            marginPercentage,
            bankPercentage,
            sopPercentage,
          });

          expect(round2(result.unitSellingAmount * quantity)).toBe(result.sellingAmount);
        }
      }
    }
  });

  it("leaves no rounding residual: directCost + margin + bank + sop === sellingAmount exactly", () => {
    const quantities = [1, 2.5, 3, 7, 11, 13];
    const costs = [1000.33, 285000.67, 12345.01];
    const percentageSets: Array<[number, number, number]> = [
      [15, 0, 0],
      [10, 5, 2],
      [33.33, 7, 0.25],
    ];

    for (const quantity of quantities) {
      for (const cost of costs) {
        for (const [marginPercentage, bankPercentage, sopPercentage] of percentageSets) {
          const result = computeSalesPricing({
            directCost: cost,
            quantity,
            marginPercentage,
            bankPercentage,
            sopPercentage,
          });

          expect(
            round2(cost + result.marginAmount + result.bankAmount + result.sopAmount),
          ).toBe(result.sellingAmount);
        }
      }
    }
  });

  it("keeps both invariants for a fractional quantity", () => {
    const result = computeSalesPricing({
      directCost: 2500,
      quantity: 2.5,
      marginPercentage: 20,
      bankPercentage: 3,
      sopPercentage: 1,
    });

    expect(round2(result.unitSellingAmount * 2.5)).toBe(result.sellingAmount);
    expect(
      round2(2500 + result.marginAmount + result.bankAmount + result.sopAmount),
    ).toBe(result.sellingAmount);
  });

  it("reports unitCost as directCost / quantity", () => {
    const result = computeSalesPricing({
      directCost: 3333.33,
      quantity: 3,
      marginPercentage: 0,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.unitCost).toBe(3333.33 / 3);
  });

  it("defaults to quantity 1 when quantity is omitted or invalid", () => {
    const withQuantity = computeSalesPricing({
      directCost: 1000,
      quantity: 1,
      marginPercentage: 10,
      bankPercentage: 5,
      sopPercentage: 2,
    });
    const withoutQuantity = computeSalesPricing({
      directCost: 1000,
      marginPercentage: 10,
      bankPercentage: 5,
      sopPercentage: 2,
    });

    expect(withoutQuantity).toEqual(withQuantity);
  });

  it("treats a non-finite direct cost as zero", () => {
    const result = computeSalesPricing({
      directCost: Number.NaN,
      quantity: 1,
      marginPercentage: 10,
      bankPercentage: 10,
      sopPercentage: 10,
    });

    expect(result).toEqual({
      marginAmount: 0,
      bankAmount: 0,
      sopAmount: 0,
      sellingAmount: 0,
      unitCost: 0,
      unitSellingAmount: 0,
    });
  });

  it("defaults NaN percentages to zero without affecting the selling price", () => {
    const result = computeSalesPricing({
      directCost: 500,
      quantity: 1,
      marginPercentage: Number.NaN,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.marginAmount).toBe(0);
    expect(result.sellingAmount).toBe(500);
  });

  it("derives marginAmount from the rounded per-unit selling price, not the unrounded exact value", () => {
    // Unit cost = 2/3 = 0.6666...; unit selling = 0.6666.../0.64 =
    // 1.041666... -> rounds to 1.04 (the per-unit rounding this change
    // introduces). Line selling = 1.04 * 3 = 3.12, so marginAmount =
    // 3.12 - 2 = 1.12. This used to be 1.13 under the old round-the-line-
    // total-only convention (1.0416666... * 3 = 3.125, rounds to 3.13); the
    // new value is what a per-unit costing sheet would produce.
    const result = computeSalesPricing({
      directCost: 2,
      quantity: 3,
      marginPercentage: 36,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.marginAmount).toBe(1.12);
    expect(result.sellingAmount).toBe(3.12);
  });

  it("clamps a margin% of 100 or more instead of dividing by zero", () => {
    const result = computeSalesPricing({
      directCost: 1000,
      quantity: 1,
      marginPercentage: 150,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(Number.isFinite(result.sellingAmount)).toBe(true);
    expect(result.sellingAmount).toBeGreaterThan(0);
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
      marginAmount: 236.11,
      bankAmount: 55.56,
      sopAmount: 23.33,
      // itemA sellingAmount 1190 + itemB sellingAmount 625 (500 / 0.8 = 625,
      // exact, no rounding up).
      sellingAmount: 1815,
      // Blended percentages are an effective on-cost markup rollup (amount /
      // totalCost), not a reconstruction of the input margin/bank/sop% --
      // margin% is gross-margin-on-price now, so it won't match 10/20's blend.
      marginPercentage: 15.74,
      bankPercentage: 3.7,
      sopPercentage: 1.56,
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

describe("repriceStoredItems", () => {
  it("recomputes amounts from stored cost/percentages, ignoring stale persisted amounts", () => {
    // Real-world example: this item's amounts were persisted under the
    // pre-1119d85 flat formula (amount = cost x %, independent of margin and
    // bank), so the "stored amount" a caller might otherwise trust is wrong.
    // repriceStoredItems only looks at directCost/quantity/percentages.
    const { items, aggregate } = repriceStoredItems([
      {
        directCost: 285000,
        quantity: 1,
        marginPercentage: 30,
        bankPercentage: 5,
        sopPercentage: 5,
      },
    ]);

    // afterMargin = 285000 / 0.7 = 407142.857..; bank = afterMargin * 0.05;
    // afterBank = afterMargin + bank; sop = afterBank * 0.05 = 21375 (not the
    // old flat-formula 14250 = 285000 * 0.05).
    expect(items[0].sopAmount).toBeCloseTo(21375, 2);
    expect(aggregate).not.toBeNull();
    expect(aggregate!.sopAmount).toBeCloseTo(21375, 2);
    expect(aggregate!.sellingAmount).toBeCloseTo(items[0].sellingAmount!, 2);
  });

  it("leaves an item's amounts null and excludes it from the aggregate when none of its percentages are set", () => {
    const { items, aggregate } = repriceStoredItems([
      {
        directCost: 285000,
        quantity: 1,
        marginPercentage: null,
        bankPercentage: null,
        sopPercentage: null,
      },
    ]);

    expect(items[0]).toEqual({
      marginAmount: null,
      bankAmount: null,
      sopAmount: null,
      sellingAmount: null,
      unitCost: null,
      unitSellingAmount: null,
    });
    expect(aggregate).toBeNull();
  });

  it("treats a null bank/sop percentage as zero once margin is set, still producing an aggregate", () => {
    const { items, aggregate } = repriceStoredItems([
      {
        directCost: 1000,
        quantity: 1,
        marginPercentage: 10,
        bankPercentage: null,
        sopPercentage: null,
      },
    ]);

    expect(items[0].marginAmount).toBeCloseTo(111.11, 2);
    expect(items[0].bankAmount).toBe(0);
    expect(items[0].sopAmount).toBe(0);
    expect(aggregate).not.toBeNull();
  });

  it("aggregates only the priced items when mixed with unpriced ones", () => {
    const { items, aggregate } = repriceStoredItems([
      {
        directCost: 1000,
        quantity: 1,
        marginPercentage: 10,
        bankPercentage: 0,
        sopPercentage: 0,
      },
      {
        directCost: 500,
        quantity: 1,
        marginPercentage: null,
        bankPercentage: null,
        sopPercentage: null,
      },
    ]);

    expect(items[1].sellingAmount).toBeNull();
    // Only the priced 1000-cost item feeds the aggregate's directCost.
    expect(aggregate!.directCost).toBe(1000);
  });

  it("returns a null aggregate for an empty item list", () => {
    expect(repriceStoredItems([])).toEqual({ items: [], aggregate: null });
  });
});

describe("computeVatBreakdown", () => {
  it("extracts the 12% VAT already embedded in each amount, without adding anything to the total", () => {
    const pricing: SalesPricingAmounts = {
      marginAmount: 100,
      bankAmount: 50,
      sopAmount: 20,
      sellingAmount: 1170,
    };

    // net = amount / 1.12, vat = amount - net (e.g. 100 / 1.12 = 89.29, vat = 10.71)
    expect(computeVatBreakdown(pricing)).toEqual({
      marginNetOfVat: 89.29,
      marginVat: 10.71,
      bankNetOfVat: 44.64,
      bankVat: 5.36,
      sopNetOfVat: 17.86,
      sopVat: 2.14,
      // grandTotal is just sellingAmount unchanged -- no VAT added on top.
      grandTotal: 1170,
    });
  });

  it("returns zeroed VAT when there are no taxable components", () => {
    const pricing: SalesPricingAmounts = {
      marginAmount: 0,
      bankAmount: 0,
      sopAmount: 0,
      sellingAmount: 800,
    };

    expect(computeVatBreakdown(pricing)).toEqual({
      marginNetOfVat: 0,
      marginVat: 0,
      bankNetOfVat: 0,
      bankVat: 0,
      sopNetOfVat: 0,
      sopVat: 0,
      grandTotal: 800,
    });
  });
});

describe("round2", () => {
  it("rounds a value that lands exactly on a centavo boundary correctly, despite floating-point noise", () => {
    // 1.125 isn't exactly representable in binary floating point -- the raw
    // JS value is 1.1249999999999996. Naive `Math.round(n * 100) / 100`
    // rounds that down to 1.12; round2's toPrecision(12) pre-snap recovers
    // the true value (1.125) and rounds it up to 1.13 under standard
    // round-half-up, matching what a real spreadsheet's ROUND(1.125, 2)
    // produces.
    expect(round2(1.125)).toBe(1.13);
  });

  it("normalizes negative zero to zero", () => {
    expect(round2(-0)).toBe(0);
  });
});
