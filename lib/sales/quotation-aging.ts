export type QuotationAging = {
  /** Days elapsed since costing was approved. Rounded down to whole days. */
  days: number;
  /** True while the quotation hasn't converted to a PO yet — the count is still running. */
  isOpen: boolean;
};

/**
 * How long a costed quotation has taken to turn into a purchase order.
 * Returns `null` when costing hasn't been approved yet — there's no clock to
 * start. While `poConvertedAt` is null the count runs to `now`; once a PO is
 * linked, the count freezes at that timestamp.
 */
export function getQuotationAging(
  costingApprovedAt: string | null,
  poConvertedAt: string | null,
  now: Date = new Date(),
): QuotationAging | null {
  if (!costingApprovedAt) {
    return null;
  }

  const start = new Date(costingApprovedAt).getTime();
  const end = poConvertedAt ? new Date(poConvertedAt).getTime() : now.getTime();
  const days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));

  return { days, isOpen: poConvertedAt === null };
}
