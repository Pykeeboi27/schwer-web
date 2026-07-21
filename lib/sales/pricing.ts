const round2 = (n: number) => Math.round(n * 100) / 100;
const VAT_RATE = 0.12;

export type SalesPricing = {
  marginAmount: number;
  bankAmount: number;
  sopAmount: number;
  /** cost + margin + bank + sop -- pre-VAT. */
  sellingAmount: number;
};

export function computeSalesPricing(input: {
  directCost: number;
  marginPercentage: number;
  bankPercentage: number;
  sopPercentage: number;
}): SalesPricing {
  const cost = Number.isFinite(input.directCost) ? input.directCost : 0;
  const marginAmount = round2((cost * (input.marginPercentage || 0)) / 100);
  const bankAmount = round2((cost * (input.bankPercentage || 0)) / 100);
  const sopAmount = round2((cost * (input.sopPercentage || 0)) / 100);
  const sellingAmount = round2(cost + marginAmount + bankAmount + sopAmount);

  return { marginAmount, bankAmount, sopAmount, sellingAmount };
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

export type VatBreakdown = {
  marginVat: number;
  bankVat: number;
  sopVat: number;
  /** The final, VAT-inclusive grand total: pricing.sellingAmount + VAT. */
  grandTotal: number;
};

/**
 * Applies 12% VAT to margin/bank/sop ONCE, on an already-rolled-up total
 * (the aggregate selling amount) -- not per item and not baked into
 * sellingAmount itself. This is what should become the record's final
 * amount/po_amount; sellingAmount stays the pre-VAT figure.
 */
export function computeVatBreakdown(pricing: SalesPricing): VatBreakdown {
  const marginVat = round2(pricing.marginAmount * VAT_RATE);
  const bankVat = round2(pricing.bankAmount * VAT_RATE);
  const sopVat = round2(pricing.sopAmount * VAT_RATE);
  const grandTotal = round2(pricing.sellingAmount + marginVat + bankVat + sopVat);
  return { marginVat, bankVat, sopVat, grandTotal };
}
