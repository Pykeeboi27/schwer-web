/**
 * Pure sales pricing math, safe to import from both client components and
 * server actions (no Supabase / server-only imports here).
 *
 *   margin_amount  = direct_cost * margin_percentage / 100
 *   bank_amount    = direct_cost * bank_percentage   / 100
 *   sop_amount     = direct_cost * sop_percentage    / 100
 *   selling_amount = direct_cost + margin_amount + bank_amount + sop_amount
 */
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
