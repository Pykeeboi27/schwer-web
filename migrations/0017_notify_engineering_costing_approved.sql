-- Symmetric with the existing costing-rejection broadcast in
-- fn_notify_quotation_resolved (migration 0013): when the executive approves
-- a costing quotation, notify the engineering department too, not just the
-- sales preparer -- they costed it and the item moves out of their pending
-- queue into their "Approved History" panel on the same
-- /protected/engineering/quotations page, so that's still the right link.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_notify_quotation_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_reason TEXT;
  v_engineering_recipient RECORD;
BEGIN
  IF NEW.phase = 'sales' AND NEW.status IN ('approved', 'rejected')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_recipient := COALESCE(NEW.sales_person_id, NEW.prepared_by);

    IF NEW.status = 'rejected' THEN
      SELECT rejection_reason INTO v_reason
      FROM public.quotation_approvals
      WHERE quotation_id = NEW.id AND status = 'rejected'
      ORDER BY updated_at DESC
      LIMIT 1;
    ELSE
      v_reason := NULL;
    END IF;

    IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications
        (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
      VALUES (
        v_recipient,
        auth.uid(),
        CASE WHEN NEW.status = 'approved' THEN 'quotation_approved' ELSE 'quotation_rejected' END,
        'quotations',
        'quotation',
        NEW.id,
        'Quotation ' || NEW.quotation_number ||
          CASE WHEN NEW.status = 'approved' THEN ' was approved' ELSE ' was rejected' END,
        v_reason,
        '/protected/sales/quotations'
      );
    END IF;
  END IF;

  IF OLD.costing_approved_at IS NULL AND NEW.costing_approved_at IS NOT NULL THEN
    v_recipient := NEW.prepared_by;
    IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications
        (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
      VALUES (
        v_recipient,
        auth.uid(),
        'costing_approved',
        'request_for_quotation',
        'quotation',
        NEW.id,
        'Costing for quotation ' || NEW.quotation_number || ' was approved',
        NULL,
        '/protected/sales/request-for-quotation'
      );
    END IF;

    FOR v_engineering_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'engineering' AND is_active = TRUE
    LOOP
      IF v_engineering_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_engineering_recipient.id,
          auth.uid(),
          'costing_quotation_approved',
          'engineering_quotations',
          'quotation',
          NEW.id,
          'Quotation ' || NEW.quotation_number || ' costing was approved',
          NEW.subject,
          '/protected/engineering/quotations'
        );
      END IF;
    END LOOP;
  END IF;

  IF OLD.costing_rejection_reason IS NULL AND NEW.costing_rejection_reason IS NOT NULL THEN
    v_recipient := NEW.prepared_by;
    IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications
        (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
      VALUES (
        v_recipient,
        auth.uid(),
        'costing_rejected',
        'request_for_quotation',
        'quotation',
        NEW.id,
        'Costing for quotation ' || NEW.quotation_number || ' was rejected',
        NEW.costing_rejection_reason,
        '/protected/sales/request-for-quotation'
      );
    END IF;

    FOR v_engineering_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'engineering' AND is_active = TRUE
    LOOP
      IF v_engineering_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_engineering_recipient.id,
          auth.uid(),
          'costing_quotation_returned',
          'engineering_quotations',
          'quotation',
          NEW.id,
          'Quotation ' || NEW.quotation_number || ' was sent back for costing rework',
          NEW.costing_rejection_reason,
          '/protected/engineering/quotations'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
