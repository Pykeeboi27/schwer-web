import { computeVatBreakdown } from "@/lib/sales/pricing";
import { formatCurrency } from "@/lib/utils/number-format";
import { cn } from "@/lib/utils";

type PricingBreakdownProps = {
  directCost: number;
  marginAmount: number;
  bankAmount: number;
  sopAmount: number;
  sellingAmount: number;
  className?: string;
};

/**
 * Walks a quotation/PO's pre-VAT waterfall (cost -> margin -> bank -> sop ->
 * selling price) and then shows the 12% VAT already embedded in
 * margin/bank/sop as a net/VAT split -- not an additional charge. Matches
 * the source costing worksheet: cost is already VAT-inclusive (Engineering's
 * unit costs), so sellingAmount IS the final total, nothing gets added on
 * top of it here. sellingAmount carries the source worksheet's ceiling rule
 * indirectly: computeSalesPricing rounds the per-unit selling price UP to the
 * nearest ₱100, and sellingAmount is that ceiling'd figure times quantity.
 *
 * directCost + marginAmount + bankAmount + sopAmount always foots exactly to
 * sellingAmount -- computeSalesPricing derives the three amounts as
 * telescoping differences between rounded running per-unit totals, so there
 * is no rounding residual to show here (as long as callers pass a directCost
 * that matches the same aggregate the other four amounts were rolled up
 * from -- e.g. `pricedCost`, not the record's raw `cost`, when some items on
 * the record are still unpriced).
 */
export function PricingBreakdown({
  directCost,
  marginAmount,
  bankAmount,
  sopAmount,
  sellingAmount,
  className,
}: PricingBreakdownProps) {
  const vat = computeVatBreakdown({ marginAmount, bankAmount, sopAmount, sellingAmount });
  const totalVat = vat.marginVat + vat.bankVat + vat.sopVat;
  const netOfVat = sellingAmount - totalVat;

  return (
    <div className={cn("rounded-md border bg-muted/30 p-3 text-sm space-y-1", className)}>
      <div className="flex justify-between text-muted-foreground">
        <span>Direct Cost</span>
        <span>{formatCurrency(directCost)}</span>
      </div>
      {marginAmount !== 0 ? (
        <div className="flex justify-between text-muted-foreground">
          <span>+ Margin</span>
          <span>{formatCurrency(marginAmount)}</span>
        </div>
      ) : null}
      {bankAmount !== 0 ? (
        <div className="flex justify-between text-muted-foreground">
          <span>+ Bank</span>
          <span>{formatCurrency(bankAmount)}</span>
        </div>
      ) : null}
      {sopAmount !== 0 ? (
        <div className="flex justify-between text-muted-foreground">
          <span>+ SOP</span>
          <span>{formatCurrency(sopAmount)}</span>
        </div>
      ) : null}
      <div className="flex justify-between border-t pt-1 font-semibold">
        <span>Selling Amount (VAT-inclusive)</span>
        <span>{formatCurrency(sellingAmount)}</span>
      </div>
      {totalVat > 0 ? (
        <div className="mt-2 space-y-1 border-t pt-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            VAT already included above
          </p>
          <div className="flex justify-between text-muted-foreground">
            <span>Net of VAT</span>
            <span>{formatCurrency(netOfVat)}</span>
          </div>
          {vat.marginVat > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Margin VAT (12%)</span>
              <span>{formatCurrency(vat.marginVat)}</span>
            </div>
          ) : null}
          {vat.bankVat > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Bank VAT (12%)</span>
              <span>{formatCurrency(vat.bankVat)}</span>
            </div>
          ) : null}
          {vat.sopVat > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>SOP VAT (12%)</span>
              <span>{formatCurrency(vat.sopVat)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
