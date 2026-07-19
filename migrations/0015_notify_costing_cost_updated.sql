-- When an engineer sets/updates item unit costs on a costing quotation
-- (lib/engineering/costing-quotations.ts setQuotationItemCosts), notify the
-- sales person who created the RFQ (quotations.prepared_by).
--
-- Unlike every other notification in this feature, this one is NOT created by
-- a row-level trigger: setQuotationItemCosts() updates N quotation_items rows
-- one at a time in a loop (deliberately sequential -- see the comment on that
-- function; concurrent writes just serialize on the shared parent row
-- anyway), and a single "Save" click is one logical event, not N. A trigger
-- on quotation_items would fire once per item and spam N notifications for
-- one click. Instead, the app calls this SECURITY DEFINER RPC exactly once
-- after the whole batch succeeds, and only when at least one cost value
-- actually changed (checked app-side before calling). Regular clients have no
-- INSERT policy on notifications (see migration 0011), so this function
-- bypasses RLS deliberately and validates its own caller instead: only an
-- active engineering-department profile may invoke it, and all notification
-- content is derived server-side from target_quotation_id -- the caller
-- supplies no free-text.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_notify_costing_cost_updated(target_quotation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_engineering BOOLEAN;
  v_quotation RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND department = 'engineering' AND is_active = TRUE
  ) INTO v_caller_is_engineering;

  IF NOT v_caller_is_engineering THEN
    RAISE EXCEPTION 'Only an active engineering profile may report a costing update.';
  END IF;

  SELECT quotation_number, subject, prepared_by, phase INTO v_quotation
  FROM public.quotations
  WHERE id = target_quotation_id;

  IF NOT FOUND OR v_quotation.phase <> 'costing' THEN
    RETURN;
  END IF;

  IF v_quotation.prepared_by IS NULL OR v_quotation.prepared_by = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
  VALUES (
    v_quotation.prepared_by,
    auth.uid(),
    'costing_cost_updated',
    'request_for_quotation',
    'quotation',
    target_quotation_id,
    'Costing was updated for quotation ' || v_quotation.quotation_number,
    v_quotation.subject,
    '/protected/sales/request-for-quotation'
  );
END;
$$;

COMMIT;
