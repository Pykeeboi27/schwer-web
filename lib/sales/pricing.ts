/**
 * Rounds to 2 decimal places (centavos), first cleaning up binary
 * floating-point noise from the chained division earlier in the waterfall
 * (cost / (1 - margin%), etc. produce long repeating decimals whose IEEE754
 * representation carries trailing noise past ~15 significant digits). Plain
 * `Math.round(n * 100) / 100` can flip that noise into an incorrect round
 * UP right at the centavo boundary -- e.g. `Math.round(1.005 * 100) / 100`
 * is `1`, not `1.01`, because `1.005 * 100` is actually `100.49999999999999`
 * in floating point. Excel avoids this because it internally cleans values
 * to ~15 significant digits before rounding; snapping to 12 significant
 * digits first matches that and keeps our numbers aligned with the same
 * formula computed in Excel.
 */
export const round2 = (n: number) => Math.round(Number(n.toPrecision(12)) * 100) / 100;

/**
 * Ceilings to the nearest ₱100, first cleaning up binary floating-point
 * noise the same way `round2` does -- otherwise a value that should land
 * exactly on a clean hundred (e.g. 7600.00) could compute as
 * 7599.9999999999998 / 100 and ceiling to 7700 instead of staying at 7600.
 */
export const ceilToHundred = (n: number) =>
  Math.ceil(Number(n.toPrecision(12)) / 100) * 100;
const VAT_RATE = 0.12;

/** The four pre-VAT line amounts -- what an aggregate or a VAT breakdown needs. Excludes the per-unit fields, which only make sense for a single line. */
export type SalesPricingAmounts = {
  marginAmount: number;
  bankAmount: number;
  /** Includes the rounding bump (sellingAmount - the exact pre-ceiling total) when the selling price is ceiling'd -- see computeSalesPricing's doc comment. */
  sopAmount: number;
  /** cost + margin + bank + sop -- pre-VAT, computed per unit then scaled by quantity, then ceiling'd to the nearest ₱100. */
  sellingAmount: number;
};

export type SalesPricing = SalesPricingAmounts & {
  /** directCost / quantity. Not necessarily a clean 2dp figure until the cost side is also rounded per-unit (see lib/engineering/landed-cost.ts). */
  unitCost: number;
  /**
   * The exact per-unit selling price, rounded only to the centavo -- kept
   * unrounded-to-the-hundred on purpose, since a per-unit price landing on a
   * clean ₱100 would badly distort prices on inexpensive items. This is
   * what feeds the "Unit Selling" column and the worksheet's unit-price
   * column. Because `sellingAmount` below is ceiling'd to the nearest ₱100,
   * `unitSellingAmount * quantity` generally does NOT equal `sellingAmount`
   * -- the same tension the original costing worksheet always had.
   */
  unitSellingAmount: number;
};

/**
 * Mirrors the source costing worksheet's per-unit pricing waterfall:
 *   1. Margin is gross margin ON the selling price, not a markup on cost --
 *      Selling = Cost / (1 - margin%). A 25% margin is a ~33% markup on cost.
 *   2. Bank% and SOP% compound sequentially on top of the running total
 *      (bank on cost+margin, SOP on cost+margin+bank), not independently off
 *      raw cost.
 *   3. The final line selling price is rounded UP to the nearest ₱100 (e.g.
 *      7562.79 -> 7600.00), matching the source worksheet's ceiling rule --
 *      per product decision, this is now applied per line item, and the
 *      resulting bump (sellingAmount minus the exact pre-ceiling total) is
 *      folded entirely into sopAmount, so directCost + margin + bank + sop
 *      still sums exactly to the ceiling'd sellingAmount.
 *
 * Rounds the per-unit cumulative subtotals to the centavo first, then scales
 * each by quantity, then derives the margin/bank components as telescoping
 * differences between consecutive rounded running totals (lineCost ->
 * lineAfterMargin -> lineAfterBank), and sopAmount as the remainder up to
 * the final ceiling'd sellingAmount. This guarantees
 * directCost + margin + bank + sop === sellingAmount exactly, by
 * construction rather than by luck -- there is no leftover rounding residual
 * to display or explain. unitSellingAmount (the exact per-unit price) is
 * NOT scaled from the ceiling'd total, so it no longer multiplies out to
 * sellingAmount except by coincidence -- see its own doc comment above.
 */
export function computeSalesPricing(input: {
  /** Line total (quantity x unit cost) -- the same figure used everywhere else on the quotation/PO. */
  directCost: number;
  /** Line quantity, used only to recover the per-unit price. Defaults to 1 when omitted or invalid. */
  quantity?: number;
  marginPercentage: number;
  bankPercentage: number;
  sopPercentage: number;
}): SalesPricing {
  const lineCost = Number.isFinite(input.directCost) ? input.directCost : 0;
  const quantity =
    Number.isFinite(input.quantity) && (input.quantity as number) > 0
      ? (input.quantity as number)
      : 1;
  const unitCost = lineCost / quantity;

  // Clamped so a 100%+ input can't divide by zero or go negative.
  const marginRate = Math.min(Math.max(input.marginPercentage || 0, 0), 99.99) / 100;
  const unitAfterMarginExact = marginRate > 0 ? unitCost / (1 - marginRate) : unitCost;
  const unitAfterBankExact =
    unitAfterMarginExact * (1 + (input.bankPercentage || 0) / 100);
  const unitAfterSopExact = unitAfterBankExact * (1 + (input.sopPercentage || 0) / 100);

  const unitAfterMargin = round2(unitAfterMarginExact);
  const unitAfterBank = round2(unitAfterBankExact);
  const unitSellingAmount = round2(unitAfterSopExact);

  const lineAfterMargin = round2(unitAfterMargin * quantity);
  const lineAfterBank = round2(unitAfterBank * quantity);
  const exactSellingAmount = round2(unitSellingAmount * quantity);

  // The client's rule: the printed/stored Selling price always rounds UP to
  // the nearest ₱100. The gap this opens up versus the exact waterfall total
  // is folded entirely into sopAmount so the parts keep summing exactly.
  const sellingAmount = ceilToHundred(exactSellingAmount);
  const sopBump = round2(sellingAmount - exactSellingAmount);

  return {
    marginAmount: round2(lineAfterMargin - lineCost),
    bankAmount: round2(lineAfterBank - lineAfterMargin),
    sopAmount: round2(exactSellingAmount - lineAfterBank + sopBump),
    sellingAmount,
    unitCost,
    unitSellingAmount,
  };
}

export type AggregateSalesPricing = SalesPricingAmounts & {
  directCost: number;
  marginPercentage: number;
  bankPercentage: number;
  sopPercentage: number;
};

/**
 * Rolls per-item pricing (each item already computed via computeSalesPricing)
 * into one aggregate: summed pre-VAT amounts plus blended weighted-average
 * percentages (weighted by each item's direct cost). Used to keep the
 * record-level margin/bank/sop/selling columns on quotations/purchase_orders
 * in sync once pricing is entered per line item, so every existing reader of
 * those columns (executive dashboard, worksheet exports, collections) keeps
 * working unchanged. VAT is NOT applied here or per item -- it's computed once
 * off this aggregate via computeVatBreakdown to produce the grand total.
 *
 * Note: since computeSalesPricing's marginPercentage is now gross margin on
 * the selling price (not a markup on cost), this blended marginPercentage
 * (amount / totalCost * 100) is an effective on-cost markup figure -- it
 * won't equal the input margin% the way it used to. It's a display rollup,
 * not fed back into computeSalesPricing.
 */
export function computeAggregatePricing(
  items: Array<{
    directCost: number;
    marginAmount: number;
    bankAmount: number;
    sopAmount: number;
    sellingAmount: number;
  }>,
): AggregateSalesPricing {
  const finite = (n: number) => (Number.isFinite(n) ? n : 0);

  const totals = items.reduce(
    (acc, item) => ({
      directCost: acc.directCost + finite(item.directCost),
      marginAmount: acc.marginAmount + finite(item.marginAmount),
      bankAmount: acc.bankAmount + finite(item.bankAmount),
      sopAmount: acc.sopAmount + finite(item.sopAmount),
      sellingAmount: acc.sellingAmount + finite(item.sellingAmount),
    }),
    { directCost: 0, marginAmount: 0, bankAmount: 0, sopAmount: 0, sellingAmount: 0 },
  );

  const blendedPercent = (amount: number) =>
    totals.directCost > 0 ? round2((amount / totals.directCost) * 100) : 0;

  return {
    directCost: round2(totals.directCost),
    marginAmount: round2(totals.marginAmount),
    bankAmount: round2(totals.bankAmount),
    sopAmount: round2(totals.sopAmount),
    sellingAmount: round2(totals.sellingAmount),
    marginPercentage: blendedPercent(totals.marginAmount),
    bankPercentage: blendedPercent(totals.bankAmount),
    sopPercentage: blendedPercent(totals.sopAmount),
  };
}

export type RepricedItem = {
  marginAmount: number | null;
  bankAmount: number | null;
  sopAmount: number | null;
  sellingAmount: number | null;
  unitCost: number | null;
  unitSellingAmount: number | null;
};

export type RepriceResult = {
  items: RepricedItem[];
  /** null when none of the input items are priced (nothing to roll up). */
  aggregate: AggregateSalesPricing | null;
};

/**
 * Recomputes display pricing from each item's stored direct cost, quantity,
 * and percentages -- rather than trusting the `*_amount` columns persisted at
 * save time. Those columns only get overwritten the next time a quotation/PO
 * is edited and saved, so a record priced under an older version of
 * `computeSalesPricing` (e.g. before margin/bank/SOP compounded the way the
 * source costing worksheet does) keeps showing stale, wrong amounts forever
 * on read-only views unless something re-derives them on the way out.
 * Read loaders (quotations, purchase orders, the printed worksheet) call this
 * so every display path stays correct without a data migration -- the
 * `*_amount` columns themselves are left untouched in the database.
 *
 * An item counts as "priced" if any of its three percentages is non-null,
 * matching the null semantics `computeSalesPricing`'s callers already rely on
 * (unpriced legacy items show "--" rather than a computed zero). Unpriced
 * items are excluded from the aggregate; if none are priced, `aggregate` is
 * null so callers can leave record-level fields at their stored values.
 */
export function repriceStoredItems(
  items: Array<{
    directCost: number;
    quantity: number;
    marginPercentage: number | null;
    bankPercentage: number | null;
    sopPercentage: number | null;
  }>,
): RepriceResult {
  const repriced: RepricedItem[] = items.map((item) => {
    const isPriced =
      item.marginPercentage !== null ||
      item.bankPercentage !== null ||
      item.sopPercentage !== null;
    if (!isPriced) {
      return {
        marginAmount: null,
        bankAmount: null,
        sopAmount: null,
        sellingAmount: null,
        unitCost: null,
        unitSellingAmount: null,
      };
    }
    return computeSalesPricing({
      directCost: item.directCost,
      quantity: item.quantity,
      marginPercentage: item.marginPercentage ?? 0,
      bankPercentage: item.bankPercentage ?? 0,
      sopPercentage: item.sopPercentage ?? 0,
    });
  });

  const pricedForAggregate = items
    .map((item, index) => ({ item, pricing: repriced[index] }))
    .filter(
      (entry): entry is { item: (typeof items)[number]; pricing: SalesPricing } =>
        entry.pricing.marginAmount !== null,
    )
    .map(({ item, pricing }) => ({ directCost: item.directCost, ...pricing }));

  const aggregate =
    pricedForAggregate.length > 0 ? computeAggregatePricing(pricedForAggregate) : null;

  return { items: repriced, aggregate };
}

export type VatBreakdown = {
  marginNetOfVat: number;
  marginVat: number;
  bankNetOfVat: number;
  bankVat: number;
  sopNetOfVat: number;
  sopVat: number;
  /**
   * Equal to pricing.sellingAmount. Matching the source costing worksheet,
   * VAT is already resolved within cost (Engineering's unit costs are
   * VAT-inclusive) and the margin gross-up -- so this does NOT add anything
   * on top. It only decomposes each already-included margin/bank/sop amount
   * into its net-of-VAT and VAT pieces, for BIR-style net-sales/output-VAT
   * reporting.
   */
  grandTotal: number;
};

/**
 * Extracts the 12% VAT already embedded in each of margin/bank/sop (amount /
 * 1.12 = net, amount - net = VAT) -- it does not charge anything extra.
 * `grandTotal` is just `pricing.sellingAmount` unchanged; this exists purely
 * to break an already-final total into its net/VAT components for display
 * and worksheet printing. Note pricing.sopAmount may include the ₱100
 * ceiling-rounding bump computeSalesPricing folds into it -- that bump gets
 * decomposed into net/VAT along with the rest of sopAmount, same as any
 * other peso of it.
 */
export function computeVatBreakdown(pricing: SalesPricingAmounts): VatBreakdown {
  const decompose = (amount: number) => {
    const netOfVat = round2(amount / (1 + VAT_RATE));
    return { netOfVat, vat: round2(amount - netOfVat) };
  };
  const margin = decompose(pricing.marginAmount);
  const bank = decompose(pricing.bankAmount);
  const sop = decompose(pricing.sopAmount);
  return {
    marginNetOfVat: margin.netOfVat,
    marginVat: margin.vat,
    bankNetOfVat: bank.netOfVat,
    bankVat: bank.vat,
    sopNetOfVat: sop.netOfVat,
    sopVat: sop.vat,
    grandTotal: pricing.sellingAmount,
  };
}
