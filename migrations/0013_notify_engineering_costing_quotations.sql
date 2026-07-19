-- Fixes a gap: the engineering department had no notifications at all.
-- lib/engineering/access.ts gates the whole module purely on
-- department='engineering' (no per-user assignment column on quotations for
-- engineering, unlike sales_person_id/prepared_by), and
-- lib/engineering/costing-quotations.ts's listCostingQuotations() shows every
-- phase='costing' quotation as one shared department queue -- so, like the
-- executive costing-approval broadcast in migration 0011, this broadcasts to
-- every active engineering-department profile rather than a single recipient.
--
-- Two triggers:
--   (a) A new RFQ arrives for costing (quotations INSERT with phase='costing',
--       via lib/sales/quotations.ts createRequestForQuotation, which inserts
--       status='draft' directly -- there is no separate "submitted" step to
--       hook for the *first* arrival, unlike the later costing_approval_requested
--       draft->pending transition already handled in migration 0011).
--   (b) A costing rejection sends the quotation back to engineering's queue
--       for rework (status stays 'draft', phase stays 'costing',
--       costing_rejection_reason newly set) -- folded into the existing
--       fn_notify_quotation_resolved() via CREATE OR REPLACE, alongside the
--       already-existing prepared_by notification for the same event.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_notify_costing_quotation_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient RECORD;
BEGIN
  IF NEW.phase = 'costing' THEN
    FOR v_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'engineering' AND is_active = TRUE
    LOOP
      IF v_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_recipient.id,
          auth.uid(),
          'costing_quotation_received',
          'engineering_quotations',
          'quotation',
          NEW.id,
          'New request for quotation ' || NEW.quotation_number || ' needs costing',
          NEW.subject,
          '/protected/engineering/quotations'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_costing_quotation_received
  AFTER INSERT ON public.quotations
  FOR EACH ROW
  WHEN (NEW.phase = 'costing')
  EXECUTE FUNCTION public.fn_notify_costing_quotation_received();

-- Re-declared in full (CREATE OR REPLACE) to add the engineering broadcast on
-- costing rejection; the sales-phase and costing-approved branches are
-- unchanged from migration 0011.
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
