const round2 = (n: number) => Math.round(n * 100) / 100;

export type SalesPricing = {
  marginAmount: number;
  bankAmount: number;
  sopAmount: number;
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

export type VatBreakdown = {
  marginVat: number;
  bankVat: number;
  sopVat: number;
  grandTotal: number;
};

export function computeVatBreakdown(pricing: SalesPricing): VatBreakdown {
  const marginVat = round2(pricing.marginAmount * 0.12);
  const bankVat = round2(pricing.bankAmount * 0.12);
  const sopVat = round2(pricing.sopAmount * 0.12);
  const grandTotal = round2(pricing.sellingAmount + marginVat + bankVat + sopVat);
  return { marginVat, bankVat, sopVat, grandTotal };
}
