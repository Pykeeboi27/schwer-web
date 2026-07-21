-- Sequential approval chain: sales_manager -> executive -> owner.
--
-- Previously, submitting a quotation (or converting one to a PO) inserted
-- ALL required approval rows (sales_manager, owner, executive for amount >=
-- 3,000,000) as 'pending' in a single batch, so every approver saw the item
-- in their queue at once. The client wants strict sequencing: an item must
-- not appear in a role's approval queue until the role before it in the
-- chain has approved. The order is also changing from
-- sales_manager -> owner -> executive to sales_manager -> executive -> owner.
-- The <3,000,000 threshold is unchanged (sales_manager approval only).
--
-- This is implemented by teaching the existing SECURITY DEFINER rollup
-- triggers (fn_sync_quotation_status_from_approvals /
-- fn_sync_po_status_from_approvals) to open the next stage's pending row(s)
-- the moment the current stage is approved, instead of relying on the app to
-- insert every stage upfront. The app (lib/sales/quotations.ts,
-- lib/sales/purchase-orders.ts) now only ever seeds the sales_manager row at
-- submission/conversion/resubmission.
--
-- Doing this inside the trigger (rather than as a second statement from the
-- approver's own session) matters for two reasons:
--   1. RLS on quotation_approvals/po_approvals only allows INSERT from a
--      sales-department caller (sales_quotation_approvals_sales_insert /
--      sales_po_approvals_sales_all). An executive approving their stage is
--      NOT sales department, so it could never insert the owner's row
--      itself. The trigger is SECURITY DEFINER and already performs
--      privileged writes (the same-role sibling-cancel below), so it can.
--   2. The status rollup below considers the quotation/PO "approved" the
--      moment no pending row remains. If the next stage's row were inserted
--      as a separate statement after the approve, the rollup would
--      transiently see zero pending rows and mark the record approved (and,
--      for POs, permanently stamp approved_at, since that field's CASE keeps
--      whatever was already there once no pending/rejected row remains).
--      Opening the next stage first, inside the same trigger invocation,
--      means the rollup below always sees the correct pending row for a
--      not-yet-complete chain.
--
-- Also includes a one-time backfill for currently in-flight ('pending')
-- quotations/POs so they conform to the new sequential model instead of
-- having stale pending rows for stages they haven't reached.
--
-- Incidentally corrects a pre-existing drift between schema.sql and the
-- deployed fn_sync_quotation_status_from_approvals: schema.sql had an
-- approved_at CASE branch for quotations that was never actually deployed
-- (quotations.approved_at has always been NULL/unused at runtime, unlike the
-- PO side, which does stamp it). This migration leaves that column
-- unwritten, matching current production behavior, rather than silently
-- introducing a new side effect as part of the approval-chain change.

BEGIN;

-- ============================================================
-- 1. Quotations: sequential chain advancement
-- ============================================================

-- Also drives the sequential approval chain: sales_manager -> executive ->
-- owner (amount >= 3,000,000 only; below that, sales_manager is terminal).
-- The app only ever seeds the sales_manager row at submission
-- (lib/sales/quotations.ts, submitQuotationForApproval); this function opens
-- each subsequent stage once the prior one is approved, so a role never sees
-- an item in its approval queue before its turn. The chain order and 3M
-- threshold are intentionally duplicated in lib/sales/quotations.ts
-- (requiredApproverRolesForAmount / approvalChainForAmount / nextApproverRole)
-- for stage-1 seeding and UI display; keep both in sync if either changes.
CREATE OR REPLACE FUNCTION public.fn_sync_quotation_status_from_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid UUID;
  v_amount NUMERIC;
  v_next user_role_enum;
BEGIN
  qid := COALESCE(NEW.quotation_id, OLD.quotation_id);

  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.quotation_approvals
    SET status = 'cancelled', updated_at = NOW()
    WHERE quotation_id = qid
      AND approver_role = NEW.approver_role
      AND status = 'pending'
      AND id <> NEW.id;

    -- Sequential chain: sales_manager -> executive -> owner (owner only for
    -- amount >= 3,000,000; below that, sales_manager approval is terminal).
    -- Open the next stage here, inside the same trigger invocation, so the
    -- status recompute below always sees a fresh pending row for a
    -- not-yet-complete chain instead of transiently observing "no pending
    -- rows" and marking the quotation approved early.
    SELECT amount INTO v_amount FROM public.quotations WHERE id = qid;
    v_next := CASE NEW.approver_role
      WHEN 'sales_manager' THEN
        CASE WHEN v_amount >= 3000000 THEN 'executive'::user_role_enum ELSE NULL END
      WHEN 'executive' THEN 'owner'::user_role_enum
      ELSE NULL -- owner is terminal
    END;

    IF v_next IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.quotation_approvals
         WHERE quotation_id = qid AND approver_role = v_next
       ) THEN
      INSERT INTO public.quotation_approvals (quotation_id, approver_id, approver_role, status)
      SELECT qid, p.id, v_next, 'pending'
      FROM public.profiles p
      WHERE p.role = v_next AND p.department = 'executive' AND p.is_active = TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No active approver for role % on quotation %', v_next, qid;
      END IF;
    END IF;
  END IF;

  UPDATE public.quotations q
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'rejected'
    ) THEN 'rejected'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'pending'
    ) THEN 'pending'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'pending'
    ) THEN 'approved'::approval_status_enum
    ELSE 'pending'::approval_status_enum
  END,
  updated_at = NOW()
  WHERE q.id = qid;
  -- Note: unlike the PO version below, this does not stamp
  -- quotations.approved_at. That column exists but has never actually been
  -- written by this trigger in production; an approved_at CASE branch was
  -- drafted into schema.sql at some point but never deployed, so this
  -- migration keeps schema.sql matching deployed reality rather than
  -- silently introducing that as a side effect of the approval-chain change.

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 2. Purchase orders: sequential chain advancement
-- ============================================================

-- Mirrors fn_sync_quotation_status_from_approvals for purchase orders. Also
-- mirrors the sequential chain-advancement behavior described above the
-- quotation version: the app seeds only the sales_manager po_approvals row on
-- conversion (lib/sales/purchase-orders.ts, convertQuotationToPurchaseOrder),
-- and this function opens each subsequent stage as the prior one is approved.
CREATE OR REPLACE FUNCTION public.fn_sync_po_status_from_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  v_amount NUMERIC;
  v_next user_role_enum;
BEGIN
  pid := COALESCE(NEW.po_id, OLD.po_id);

  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.po_approvals
    SET status = 'cancelled', updated_at = NOW()
    WHERE po_id = pid
      AND approver_role = NEW.approver_role
      AND status = 'pending'
      AND id <> NEW.id;

    -- Sequential chain: sales_manager -> executive -> owner (owner only for
    -- amount >= 3,000,000). See fn_sync_quotation_status_from_approvals for
    -- why the next stage is opened here rather than from the app session.
    SELECT po_amount INTO v_amount FROM public.purchase_orders WHERE id = pid;
    v_next := CASE NEW.approver_role
      WHEN 'sales_manager' THEN
        CASE WHEN v_amount >= 3000000 THEN 'executive'::user_role_enum ELSE NULL END
      WHEN 'executive' THEN 'owner'::user_role_enum
      ELSE NULL -- owner is terminal
    END;

    IF v_next IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.po_approvals
         WHERE po_id = pid AND approver_role = v_next
       ) THEN
      INSERT INTO public.po_approvals (po_id, approver_id, approver_role, status)
      SELECT pid, p.id, v_next, 'pending'
      FROM public.profiles p
      WHERE p.role = v_next AND p.department = 'executive' AND p.is_active = TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No active approver for role % on purchase order %', v_next, pid;
      END IF;
    END IF;
  END IF;

  UPDATE public.purchase_orders p
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'rejected'
    ) THEN 'rejected'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'pending'
    ) THEN 'pending'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'pending'
    ) THEN 'approved'::approval_status_enum
    ELSE p.status
  END,
  approved_at = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status IN ('pending', 'rejected')
    ) THEN COALESCE(p.approved_at, NOW())
    ELSE NULL
  END,
  updated_at = NOW()
  WHERE p.id = pid
    AND p.status NOT IN ('draft', 'closed', 'cancelled');

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers are unchanged (still AFTER INSERT OR UPDATE OR DELETE, FOR EACH
-- ROW); only the function bodies above changed, and CREATE OR REPLACE
-- doesn't require re-registering them. Re-asserted here anyway for clarity
-- and to match this repo's existing migration convention.
DROP TRIGGER IF EXISTS trg_sync_quotation_status_from_approvals ON public.quotation_approvals;
CREATE TRIGGER trg_sync_quotation_status_from_approvals
AFTER INSERT OR UPDATE OR DELETE ON public.quotation_approvals
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_quotation_status_from_approvals();

DROP TRIGGER IF EXISTS trg_sync_po_status_from_approvals ON public.po_approvals;
CREATE TRIGGER trg_sync_po_status_from_approvals
AFTER INSERT OR UPDATE OR DELETE ON public.po_approvals
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_po_status_from_approvals();

-- ============================================================
-- 3. Backfill in-flight ('pending') quotations onto the new sequential model
-- ============================================================
--
-- For every quotation currently pending overall, walk the NEW chain order
-- (sales_manager -> executive -> owner, truncated by the 3M threshold) and
-- find the first role that does not already have an 'approved' row -- an
-- already-recorded approval counts as satisfied regardless of the OLD
-- ordering (e.g. if owner approved before executive under the old
-- sales_manager -> owner -> executive chain, that approval carries over).
-- Any role after that first unsatisfied role has its pending/cancelled rows
-- removed (they were seeded prematurely under the old all-at-once model);
-- already-approved rows for later roles are preserved untouched. The first
-- unsatisfied role is left with (or given) exactly one set of pending rows.
DO $$
DECLARE
  rec RECORD;
  v_chain user_role_enum[];
  v_approved user_role_enum[];
  v_target user_role_enum;
  v_role user_role_enum;
  v_idx INT;
BEGIN
  FOR rec IN
    SELECT id, amount FROM public.quotations WHERE status = 'pending'
  LOOP
    v_chain := CASE
      WHEN rec.amount >= 3000000
        THEN ARRAY['sales_manager', 'executive', 'owner']::user_role_enum[]
      ELSE ARRAY['sales_manager']::user_role_enum[]
    END;

    SELECT COALESCE(array_agg(DISTINCT approver_role), ARRAY[]::user_role_enum[])
      INTO v_approved
      FROM public.quotation_approvals
      WHERE quotation_id = rec.id AND status = 'approved';

    v_target := NULL;
    FOREACH v_role IN ARRAY v_chain LOOP
      IF v_target IS NULL AND NOT (v_role = ANY (v_approved)) THEN
        v_target := v_role;
      END IF;
    END LOOP;

    -- Every chain role already approved: the rollup trigger will already
    -- have (or will next fire and) mark this quotation approved. Nothing to
    -- reconcile.
    IF v_target IS NULL THEN
      CONTINUE;
    END IF;

    v_idx := array_position(v_chain, v_target);
    IF v_idx < array_length(v_chain, 1) THEN
      DELETE FROM public.quotation_approvals
      WHERE quotation_id = rec.id
        AND status IN ('pending', 'cancelled')
        AND approver_role = ANY (v_chain[v_idx + 1 : array_length(v_chain, 1)]);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.quotation_approvals
      WHERE quotation_id = rec.id AND approver_role = v_target AND status = 'pending'
    ) THEN
      -- Clear any stale cancelled rows for the target role before reseeding.
      DELETE FROM public.quotation_approvals
      WHERE quotation_id = rec.id AND approver_role = v_target AND status = 'cancelled';

      INSERT INTO public.quotation_approvals (quotation_id, approver_id, approver_role, status)
      SELECT rec.id, p.id, v_target, 'pending'
      FROM public.profiles p
      WHERE p.role = v_target
        AND p.department = (CASE WHEN v_target = 'sales_manager' THEN 'sales' ELSE 'executive' END)
        AND p.is_active = TRUE
      ON CONFLICT (quotation_id, approver_id) DO NOTHING;

      IF NOT FOUND THEN
        RAISE WARNING 'Backfill: no active approver for role % on quotation % -- leave for manual follow-up', v_target, rec.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 4. Backfill in-flight ('pending') purchase orders, same algorithm
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  v_chain user_role_enum[];
  v_approved user_role_enum[];
  v_target user_role_enum;
  v_role user_role_enum;
  v_idx INT;
BEGIN
  FOR rec IN
    SELECT id, po_amount FROM public.purchase_orders WHERE status = 'pending'
  LOOP
    v_chain := CASE
      WHEN rec.po_amount >= 3000000
        THEN ARRAY['sales_manager', 'executive', 'owner']::user_role_enum[]
      ELSE ARRAY['sales_manager']::user_role_enum[]
    END;

    SELECT COALESCE(array_agg(DISTINCT approver_role), ARRAY[]::user_role_enum[])
      INTO v_approved
      FROM public.po_approvals
      WHERE po_id = rec.id AND status = 'approved';

    v_target := NULL;
    FOREACH v_role IN ARRAY v_chain LOOP
      IF v_target IS NULL AND NOT (v_role = ANY (v_approved)) THEN
        v_target := v_role;
      END IF;
    END LOOP;

    IF v_target IS NULL THEN
      CONTINUE;
    END IF;

    v_idx := array_position(v_chain, v_target);
    IF v_idx < array_length(v_chain, 1) THEN
      DELETE FROM public.po_approvals
      WHERE po_id = rec.id
        AND status IN ('pending', 'cancelled')
        AND approver_role = ANY (v_chain[v_idx + 1 : array_length(v_chain, 1)]);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.po_approvals
      WHERE po_id = rec.id AND approver_role = v_target AND status = 'pending'
    ) THEN
      DELETE FROM public.po_approvals
      WHERE po_id = rec.id AND approver_role = v_target AND status = 'cancelled';

      INSERT INTO public.po_approvals (po_id, approver_id, approver_role, status)
      SELECT rec.id, p.id, v_target, 'pending'
      FROM public.profiles p
      WHERE p.role = v_target
        AND p.department = (CASE WHEN v_target = 'sales_manager' THEN 'sales' ELSE 'executive' END)
        AND p.is_active = TRUE
      ON CONFLICT (po_id, approver_id) DO NOTHING;

      IF NOT FOUND THEN
        RAISE WARNING 'Backfill: no active approver for role % on purchase order % -- leave for manual follow-up', v_target, rec.id;
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;
