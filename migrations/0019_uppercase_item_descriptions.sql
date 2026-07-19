-- Quotation line items are standardized to ALL CAPS. New items are uppercased
-- at write time (lib/sales/quotations.ts createRequestForQuotation). This is
-- the one-time backfill for rows created before that rule existed.
--
-- purchase_order_items are snapshots copied from quotation_items on PO
-- conversion (see migration 0008), so they are normalized too for consistency
-- with the quotations they came from and the Sales Worksheet download.

UPDATE public.quotation_items
   SET description = UPPER(description)
 WHERE description IS DISTINCT FROM UPPER(description);

UPDATE public.purchase_order_items
   SET description = UPPER(description)
 WHERE description IS DISTINCT FROM UPPER(description);
