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
const VAT_RATE = 0.12;

export type SalesPricing = {
  marginAmount: number;
  bankAmount: number;
  sopAmount: number;
  /** cost + margin + bank + sop -- pre-VAT, computed per unit then scaled by quantity. */
  sellingAmount: number;
};

/**
 * Mirrors the source costing worksheet's per-unit pricing waterfall:
 *   1. Margin is gross margin ON the selling price, not a markup on cost --
 *      Selling = Cost / (1 - margin%). A 25% margin is a ~33% markup on cost.
 *   2. Bank% and SOP% compound sequentially on top of the running total
 *      (bank on cost+margin, SOP on cost+margin+bank), not independently off
 *      raw cost.
 * Unlike the source worksheet, the final selling price is NOT rounded up to
 * the nearest ₱100 -- it's the exact cost+margin+bank+sop total (rounded only
 * to the nearest centavo, like every other amount here), per product
 * decision to show precise figures instead of the spreadsheet's ceiling rule.
 * Operates per-unit (directCost / quantity) then scales back up by quantity
 * for the line-total amounts used everywhere else in the app.
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
  const unitAfterMargin = marginRate > 0 ? unitCost / (1 - marginRate) : unitCost;
  const unitMargin = unitAfterMargin - unitCost;

  const unitBank = (unitAfterMargin * (input.bankPercentage || 0)) / 100;
  const unitAfterBank = unitAfterMargin + unitBank;

  const unitSop = (unitAfterBank * (input.sopPercentage || 0)) / 100;
  const unitAfterSop = unitAfterBank + unitSop;

  return {
    marginAmount: round2(unitMargin * quantity),
    bankAmount: round2(unitBank * quantity),
    sopAmount: round2(unitSop * quantity),
    sellingAmount: round2(unitAfterSop * quantity),
  };
}

export type AggregateSalesPricing = SalesPricing & {
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
 * and worksheet printing.
 */
export function computeVatBreakdown(pricing: SalesPricing): VatBreakdown {
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
