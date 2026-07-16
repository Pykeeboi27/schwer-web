-- Fix: Engineering's "Approved History" panel showed the quotation-level
-- total cost but no line-item breakdown.
--
-- migrations/0008's quotation_items policies scope Engineering's access to
-- phase='costing' rows (quotation_items_engineering_all), matching the
-- existing eng_quotations_eng_all policy on quotations. But
-- approveCostingQuotation flips the parent quotation to phase='sales' the
-- moment it's approved, so once a row lands in Approved History, none of
-- migrations/0008's phase-scoped quotation_items policies match anymore —
-- even though the quotations row itself stays visible to Engineering via
-- whatever policy already grants it (the parent row's cost/subject/etc. show
-- fine; only the quotation_items join was silently empty).
--
-- Rather than re-deriving every case that makes a quotation row visible,
-- delegate: quotation_items are visible to anyone who can already see the
-- parent quotations row. The inner SELECT is itself subject to the
-- requesting user's RLS on quotations, so this doesn't widen access beyond
-- "can you see the quotation" -> "can you see its items".

BEGIN;

CREATE POLICY "quotation_items_visible_with_quotation_select"
  ON public.quotation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_items.quotation_id
    )
  );

COMMIT;
