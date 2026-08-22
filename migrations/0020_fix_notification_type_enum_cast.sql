-- Fixes: "column "type" is of type notification_type_enum but expression is
-- of type text", raised when an executive resolves (approves/rejects) a
-- quotation or purchase order.
--
-- Root cause: a bare string literal ('quotation_approved') is untyped
-- ("unknown") in Postgres and implicitly casts into an enum column. A CASE
-- expression built from two such literals does NOT stay "unknown" -- Postgres
-- resolves CASE/ELSE branches to a concrete type up front, and two string
-- literals resolve to `text`, which has no implicit cast to an enum. Every
-- other notification INSERT in this feature uses a single bare literal for
-- `type` and was never affected; only the two functions below build the type
-- value with a CASE expression.
--
-- fn_notify_quotation_resolved is redefined here as it stands after migration
-- 0017 (the latest version), with an explicit cast added on its one CASE
-- expression. fn_notify_po_resolved is unchanged since migration 0011 and
-- gets the same fix.

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
        (CASE WHEN NEW.status = 'approved' THEN 'quotation_approved' ELSE 'quotation_rejected' END)::notification_type_enum,
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

CREATE OR REPLACE FUNCTION public.fn_notify_po_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
    IF NEW.status = 'rejected' THEN
      SELECT rejection_reason INTO v_reason
      FROM public.po_approvals
      WHERE po_id = NEW.id AND status = 'rejected'
      ORDER BY updated_at DESC
      LIMIT 1;
    ELSE
      v_reason := NULL;
    END IF;

    INSERT INTO public.notifications
      (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
    VALUES (
      NEW.created_by,
      auth.uid(),
      (CASE WHEN NEW.status = 'approved' THEN 'po_approved' ELSE 'po_rejected' END)::notification_type_enum,
      'purchase_orders',
      'purchase_order',
      NEW.id,
      'PO ' || NEW.po_number ||
        CASE WHEN NEW.status = 'approved' THEN ' was approved' ELSE ' was rejected' END,
      v_reason,
      '/protected/sales/purchase-orders'
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
