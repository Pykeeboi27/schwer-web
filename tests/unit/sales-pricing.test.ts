import { describe, expect, it } from "vitest";

import {
  ceilToHundred,
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
    // Exact pre-ceiling total is 1190.00, which is NOT a multiple of 100, so
    // it ceilings up to 1200.00; the 10.00 bump folds entirely into sopAmount
    // (23.33 -> 33.33). marginAmount/bankAmount are untouched by the ceiling.
    expect(result).toEqual({
      marginAmount: 111.11,
      bankAmount: 55.56,
      sopAmount: 33.33,
      sellingAmount: 1200,
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

    // Unit cost = 3333.33; unit selling = 3333.33 / 0.75 = 4444.44 (exact per
    // unit, unchanged by the ceiling step). Scaled by quantity 30, the exact
    // line total is 133333.20, which ceilings up to 133400.00; the 66.80
    // bump folds into sopAmount.
    expect(result.unitSellingAmount).toBe(4444.44);
    expect(result.sellingAmount).toBe(133400);
    expect(result.marginAmount).toBe(33333.3);
    expect(result.bankAmount).toBe(0);
    expect(result.sopAmount).toBe(66.8);
  });

  it("ceilings the exact per-unit price scaled by quantity up to the nearest ₱100, folding the bump into sopAmount -- so unit price x qty no longer equals the line total", () => {
    // Unit cost = 3333.33 / 3 = 1111.11; unit selling = 1111.11 / 0.85 =
    // 1307.1882... -> rounds to 1307.19 (exact, unaffected by the ceiling
    // step -- this is what the "Unit Selling" column and worksheet column P
    // show). The exact line total (1307.19 * 3 = 3921.57) is NOT a multiple
    // of 100, so the printed/stored Selling ceilings up to 4000.00.
    const result = computeSalesPricing({
      directCost: 3333.33,
      quantity: 3,
      marginPercentage: 15,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.unitSellingAmount).toBe(1307.19);
    expect(result.sellingAmount).toBe(4000);
    expect(result.marginAmount).toBe(588.24);
    expect(result.bankAmount).toBe(0);
    expect(result.sopAmount).toBe(78.43);
    // The old invariant (unit price x qty === line total) is deliberately
    // broken by the ceiling rule -- this is the expected, client-requested
    // divergence, not a bug.
    expect(round2(result.unitSellingAmount * 3)).not.toBe(result.sellingAmount);
  });

  it("guarantees sellingAmount is always a whole multiple of ₱100, across awkward cost/qty/percentage combinations", () => {
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

          expect(result.sellingAmount % 100).toBe(0);
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

  it("keeps the no-residual invariant for a fractional quantity (the column is NUMERIC, not INTEGER)", () => {
    const result = computeSalesPricing({
      directCost: 2500,
      quantity: 2.5,
      marginPercentage: 20,
      bankPercentage: 3,
      sopPercentage: 1,
    });

    expect(result.sellingAmount).toBe(3300);
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
    // 1.041666... -> rounds to 1.04 (the per-unit rounding a prior fix
    // introduced). Line total before the ceiling step = 1.04 * 3 = 3.12, so
    // marginAmount = 3.12 - 2 = 1.12 -- this stage is unaffected by the
    // ceiling-to-₱100 rule added here. The tiny 3.12 exact total, however,
    // ceilings all the way up to the minimum next hundred: 100.00.
    const result = computeSalesPricing({
      directCost: 2,
      quantity: 3,
      marginPercentage: 36,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.marginAmount).toBe(1.12);
    expect(result.sellingAmount).toBe(100);
  });

  it("ceilings the client's worked example (7,562.79) up to the next hundred (7,600.00)", () => {
    // margin/bank/sop all zero -> unitSellingAmount === directCost exactly,
    // isolating the ceiling step itself.
    const result = computeSalesPricing({
      directCost: 7562.79,
      quantity: 1,
      marginPercentage: 0,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.unitSellingAmount).toBe(7562.79);
    expect(result.sellingAmount).toBe(7600);
  });

  it("leaves an already-exact multiple of ₱100 unchanged, despite floating-point noise", () => {
    const result = computeSalesPricing({
      directCost: 7600,
      quantity: 1,
      marginPercentage: 0,
      bankPercentage: 0,
      sopPercentage: 0,
    });

    expect(result.sellingAmount).toBe(7600);
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
      // marginAmount/bankAmount are untouched by the ceiling step, so these
      // two stay the same as the pre-ceiling exact waterfall would give.
      marginAmount: 236.11,
      bankAmount: 55.56,
      // itemA's exact 1190.00 ceilings to 1200.00 (sop 23.33 -> 33.33);
      // itemB's exact 625.00 (500 / 0.8, no bank/sop) ceilings to 700.00
      // (sop 0 -> 75.00). Summed bump-inclusive sop: 33.33 + 75 = 108.33.
      sopAmount: 108.33,
      sellingAmount: 1900,
      // Blended percentages are an effective on-cost markup rollup (amount /
      // totalCost), not a reconstruction of the input margin/bank/sop% --
      // margin% is gross-margin-on-price now, so it won't match 10/20's blend.
      marginPercentage: 15.74,
      bankPercentage: 3.7,
      sopPercentage: 7.22,
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
    // afterBank = afterMargin + bank; exact sop (pre-ceiling) = afterBank *
    // 0.05 = 21375 (not the old flat-formula 14250 = 285000 * 0.05). The
    // exact line total (448875.00) isn't a multiple of 100, so it ceilings
    // to 448900.00; the 25.00 bump folds into sopAmount (21375 -> 21400).
    expect(items[0].sopAmount).toBeCloseTo(21400, 2);
    expect(items[0].sellingAmount).toBeCloseTo(448900, 2);
    expect(aggregate).not.toBeNull();
    expect(aggregate!.sopAmount).toBeCloseTo(21400, 2);
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
    // sopAmount is no longer simply 0 just because sop% is 0/null -- the
    // exact line total (1111.11) isn't a multiple of 100, so it ceilings to
    // 1200.00, and that 88.89 bump folds into sopAmount even with sop% unset.
    expect(items[0].sopAmount).toBeCloseTo(88.89, 2);
    expect(items[0].sellingAmount).toBeCloseTo(1200, 2);
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

describe("ceilToHundred", () => {
  it("rounds the client's worked example up to the next hundred", () => {
    expect(ceilToHundred(7562.79)).toBe(7600);
  });

  it("leaves an already-exact multiple of 100 unchanged, despite floating-point noise", () => {
    // Guards the same class of bug round2 guards against: a value that
    // should be exactly 7600 could compute as 7599.9999999999998 / 100 and
    // wrongly ceiling to 7700 without the toPrecision(12) pre-snap.
    expect(ceilToHundred(7600)).toBe(7600);
  });

  it("bumps a value just barely over a clean hundred to the NEXT hundred, not the same one", () => {
    expect(ceilToHundred(7600.01)).toBe(7700);
  });

  it("treats zero as already a multiple of 100", () => {
    expect(ceilToHundred(0)).toBe(0);
  });
});
