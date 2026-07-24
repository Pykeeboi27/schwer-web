-- Fixes a bug where resubmitting a rejected quotation/PO could leave it
-- permanently stuck: status = 'pending' but with zero pending approval rows,
-- invisible to any approver's queue.
--
-- Root cause: lib/sales/quotations.ts resubmitQuotationForApproval (and the
-- purchase-orders.ts equivalent) did the status flip, the DELETE of the old
-- approval row(s), and the INSERT of the new stage-one row as three separate,
-- non-transactional client calls, with the status flip happening FIRST. Two
-- ways this broke:
--   1. On quotations, the sales_quotation_approvals_sales_delete_pending RLS
--      policy only allows deleting a row when it is still 'pending' AND the
--      parent quotation is still 'draft' -- neither holds for a rejected row
--      being resubmitted (row is 'rejected', quotation had already been
--      flipped to 'pending' by step 1). The DELETE silently matched zero
--      rows (RLS filters, no error), so the old rejected row was never
--      removed, and the subsequent INSERT then hit the
--      UNIQUE (quotation_id, approver_id) constraint and threw.
--   2. Even when the DELETE succeeds (as on POs, whose sales RLS policy has
--      no such restriction), if the INSERT step throws for any other reason
--      (e.g. no active approver for the role), the quotation/PO is left with
--      status already flipped to 'pending' and no approval row at all.
--
-- Fix: do the whole resubmit (delete old approvals, insert the new stage-one
-- row, flip status) inside a single SECURITY DEFINER function so it runs in
-- one transaction -- if anything fails (including "no active approver"), the
-- whole thing rolls back and the record stays cleanly 'rejected'. This also
-- sidesteps the RLS gap on quotation_approvals the same way
-- fn_sync_quotation_status_from_approvals already does for privileged writes
-- to that table (see migrations/0022_sequential_approval_chain.sql).
--
-- The approval chain always starts at 'sales_manager' regardless of amount
-- (see approvalChainForAmount in lib/sales/quotations.ts), so both functions
-- hardcode the first stage rather than re-deriving it.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_resubmit_quotation_for_approval(p_quotation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status approval_status_enum;
BEGIN
  SELECT status INTO v_status
  FROM public.quotations
  WHERE id = p_quotation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotation not found.';
  END IF;

  IF v_status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected quotations can be resubmitted.';
  END IF;

  DELETE FROM public.quotation_approvals WHERE quotation_id = p_quotation_id;

  INSERT INTO public.quotation_approvals (quotation_id, approver_id, approver_role, status)
  SELECT p_quotation_id, p.id, 'sales_manager', 'pending'
  FROM public.profiles p
  WHERE p.role = 'sales_manager' AND p.department = 'sales' AND p.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active approver for role sales_manager on quotation %', p_quotation_id;
  END IF;

  UPDATE public.quotations
  SET status = 'pending', rejection_reason = NULL, submitted_at = NOW()
  WHERE id = p_quotation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resubmit_quotation_for_approval(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_resubmit_po_for_approval(p_po_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status approval_status_enum;
BEGIN
  SELECT status INTO v_status
  FROM public.purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found.';
  END IF;

  IF v_status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected purchase orders can be resubmitted.';
  END IF;

  DELETE FROM public.po_approvals WHERE po_id = p_po_id;

  INSERT INTO public.po_approvals (po_id, approver_id, approver_role, status)
  SELECT p_po_id, p.id, 'sales_manager', 'pending'
  FROM public.profiles p
  WHERE p.role = 'sales_manager' AND p.department = 'sales' AND p.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active approver for role sales_manager on purchase order %', p_po_id;
  END IF;

  UPDATE public.purchase_orders
  SET status = 'pending', submitted_at = NOW()
  WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resubmit_po_for_approval(UUID) TO authenticated;

COMMIT;
