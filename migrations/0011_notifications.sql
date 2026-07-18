-- Adds a persisted, per-user notification feed for the bell/dropdown, the full
-- notifications history page, and the small "unseen changes" dots on nav tabs.
--
-- Notifications are created entirely by SECURITY DEFINER triggers (never by
-- application code) so every status-changing path is covered automatically,
-- mirroring the existing fn_audit_trigger()/fn_set_updated_at() pattern.
--
-- Two independent "cleared" timestamps drive two different UI signals:
--   read_at  -> bell unread count; cleared when the user clicks that notification.
--   seen_at  -> nav-tab dot;       cleared when the user visits that section's tab
--               (app-level, via markSectionSeen()), even if the notification
--               itself was never opened.
--
-- Scope is strictly personal: an approver assigned via quotation_approvals/
-- po_approvals.approver_id, or the owner of a quotation/PO
-- (sales_person_id/prepared_by/created_by). Company-wide browse views never
-- generate notifications because nothing there fires these triggers.
--
-- Costing-phase quotations have no per-approver assignment row (any active
-- profile with role='executive' AND department='executive' can act, per
-- lib/executive/costing-approvals.ts assertExecutiveActor()), so the costing
-- "approval requested" notification fans out to every such profile instead of
-- a single recipient.

BEGIN;

CREATE TYPE notification_type_enum AS ENUM (
  'quotation_approval_requested',
  'quotation_approved',
  'quotation_rejected',
  'po_approval_requested',
  'po_approved',
  'po_rejected',
  'costing_approval_requested',
  'costing_approved',
  'costing_rejected'
);

-- One section per nav tab that can show an "unseen changes" dot. Sales-phase
-- quotation outcomes surface on the Quotations tab; costing outcomes surface
-- on Request for Quotation, since that's where a preparer tracks their
-- costing-phase items (lib/sales/quotations.ts's costing list is filtered to
-- phase='costing' AND prepared_by = current user, shown on that tab, not the
-- Quotations tab which is phase='sales' only).
CREATE TYPE notification_section_enum AS ENUM (
  'request_for_quotation',
  'quotations',
  'purchase_orders',
  'approvals',
  'costing_approvals'
);

CREATE TABLE public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type         notification_type_enum NOT NULL,
  section      notification_section_enum NOT NULL,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('quotation', 'purchase_order')),
  entity_id    UUID NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT NOT NULL,
  read_at      TIMESTAMPTZ,
  seen_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bell dropdown / unread count.
CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications(recipient_id, created_at DESC) WHERE read_at IS NULL;
-- Nav-tab dot lookup.
CREATE INDEX idx_notifications_recipient_section_unseen
  ON public.notifications(recipient_id, section) WHERE seen_at IS NULL;
-- Full paginated history page.
CREATE INDEX idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC);

CREATE TRIGGER trg_updated_at_notifications
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Deliberately NOT audited (unlike quotations/clients/etc.): notifications are
-- high-volume, derived, self-healing rows, not a source of truth worth a
-- second audit_logs copy.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_recipient_read"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Mark-read / mark-seen only; recipient may only ever touch their own rows,
-- and WITH CHECK keeps recipient_id from being reassigned. No INSERT/DELETE
-- policy exists, so clients can neither forge nor delete notifications --
-- only the SECURITY DEFINER trigger functions below (which bypass RLS) insert
-- rows.
CREATE POLICY "notifications_recipient_update"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ============================================================
-- Trigger functions
-- ============================================================

-- (a) A quotation approval was assigned to an approver -> notify them.
CREATE OR REPLACE FUNCTION public.fn_notify_quotation_approver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation RECORD;
  v_link TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT quotation_number, subject INTO v_quotation
  FROM public.quotations WHERE id = NEW.quotation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_link := CASE
    WHEN NEW.approver_role IN ('owner', 'executive') THEN '/protected/executive/approvals'
    ELSE '/protected/sales/approvals'
  END;

  IF NEW.approver_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
    VALUES (
      NEW.approver_id,
      auth.uid(),
      'quotation_approval_requested',
      'approvals',
      'quotation',
      NEW.quotation_id,
      'Quotation ' || v_quotation.quotation_number || ' needs your approval',
      v_quotation.subject,
      v_link
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_quotation_approver
  AFTER INSERT ON public.quotation_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_quotation_approver();

-- (b) A PO approval was assigned to an approver -> notify them.
CREATE OR REPLACE FUNCTION public.fn_notify_po_approver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po RECORD;
  v_link TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT po_number, subject INTO v_po
  FROM public.purchase_orders WHERE id = NEW.po_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_link := CASE
    WHEN NEW.approver_role IN ('owner', 'executive') THEN '/protected/executive/approvals'
    ELSE '/protected/sales/approvals'
  END;

  IF NEW.approver_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
    VALUES (
      NEW.approver_id,
      auth.uid(),
      'po_approval_requested',
      'approvals',
      'purchase_order',
      NEW.po_id,
      'PO ' || v_po.po_number || ' needs your approval',
      v_po.subject,
      v_link
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_po_approver
  AFTER INSERT ON public.po_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_po_approver();

-- (c) A costing-phase quotation was submitted for costing approval (engineering
-- moves it draft -> pending while phase='costing') -> broadcast to every
-- active executive-department executive, since costing approval has no
-- per-approver assignment row.
CREATE OR REPLACE FUNCTION public.fn_notify_costing_approval_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient RECORD;
BEGIN
  IF NEW.phase = 'costing' AND NEW.status = 'pending' AND OLD.status = 'draft' THEN
    FOR v_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'executive' AND role = 'executive' AND is_active = TRUE
    LOOP
      IF v_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_recipient.id,
          auth.uid(),
          'costing_approval_requested',
          'costing_approvals',
          'quotation',
          NEW.id,
          'Quotation ' || NEW.quotation_number || ' needs costing approval',
          NEW.subject,
          '/protected/executive/costing-approvals'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_costing_approval_requested
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_notify_costing_approval_requested();

-- (d) A quotation reached a terminal outcome -> notify its owner. Covers both
-- the sales-phase chain (status -> approved/rejected) and the costing-phase
-- decision (costing_approved_at / costing_rejection_reason newly set; costing
-- approval resets status back to 'draft' rather than 'approved', so it can't
-- be detected via the status column alone).
--
-- quotations.status is itself driven by fn_sync_quotation_status_from_approvals
-- (see above in this file), which aggregates quotation_approvals rows but never
-- writes quotations.rejection_reason (that column is otherwise unused/always
-- NULL in this schema) -- the actual reason lives on whichever
-- quotation_approvals row was rejected, so it's pulled from there.
CREATE OR REPLACE FUNCTION public.fn_notify_quotation_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_reason TEXT;
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
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_quotation_resolved
  AFTER UPDATE OF status, costing_approved_at, costing_rejection_reason ON public.quotations
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.costing_approved_at IS DISTINCT FROM NEW.costing_approved_at
    OR OLD.costing_rejection_reason IS DISTINCT FROM NEW.costing_rejection_reason
  )
  EXECUTE FUNCTION public.fn_notify_quotation_resolved();

-- (e) A PO reached a terminal outcome -> notify its creator. Mirrors (d): the
-- rejection reason lives on the rejected po_approvals row, not on
-- purchase_orders itself.
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
      CASE WHEN NEW.status = 'approved' THEN 'po_approved' ELSE 'po_rejected' END,
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

CREATE TRIGGER trg_notify_po_resolved
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_notify_po_resolved();

-- Realtime delivery: the bell subscribes to a per-user filtered channel
-- (recipient_id=eq.<uid>), the first filtered postgres_changes subscription in
-- this codebase (existing RealtimeRefresh channels are unfiltered/table-wide).
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

COMMIT;
