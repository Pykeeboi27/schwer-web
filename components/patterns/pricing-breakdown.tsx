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
 * top of it here. sellingAmount is not rounded up to the nearest ₱100 (the
 * source worksheet's rule) -- it's the exact total, to the centavo.
 */
export function PricingBreakdown({
  directCost,
  marginAmount,
  bankAmount,
  sopAmount,
  sellingAmount,
  className,
}: PricingBreakdownProps) {
  // sellingAmount is rounded once (to the centavo) from the exact per-unit
  // sum, while the components above are each rounded independently -- so
  // they can differ from sellingAmount by a centavo or two. This surfaces
  // that residual, not a deliberate rounding rule.
  const sumOfParts = directCost + marginAmount + bankAmount + sopAmount;
  const rounding = sellingAmount - sumOfParts;
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
      {Math.abs(rounding) >= 0.01 ? (
        <div className="flex justify-between text-muted-foreground">
          <span>Rounding</span>
          <span>{formatCurrency(rounding)}</span>
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
