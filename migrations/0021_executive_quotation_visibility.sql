-- Executive full quotation visibility for the new Executive > Quotations tracking tab.
--
-- Today executives only see quotations >= 3,000,000 (sales_quotations_executive_high_value_select,
-- for the Approvals worklist). The new Executive > Quotations tab needs to list every quotation
-- regardless of amount or status, mirroring the already-unrestricted po_executive_select policy on
-- purchase_orders (migrations/0002).
--
-- quotation_items needs no matching change here: migration 0009 already delegates item visibility
-- to "can you see the parent quotations row" (quotation_items_visible_with_quotation_select), so
-- granting broader access on quotations automatically extends to its items.
--
-- RLS policies for a given command are OR'd together, so this is additive: the existing high-value
-- policy keeps working unchanged (e.g. for any caller path that still relies on it), and no existing
-- access is narrowed.

BEGIN;

DROP POLICY IF EXISTS "quotations_executive_select_all" ON public.quotations;
CREATE POLICY "quotations_executive_select_all"
  ON public.quotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'executive'
        AND p.role IN ('owner', 'executive')
        AND p.is_active = TRUE
    )
  );

COMMIT;
