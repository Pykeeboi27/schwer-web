-- Existing Purchase Order Encoding: lets Sales backfill already-existing,
-- already-won purchase orders directly into the system for record-keeping,
-- with no approval workflow and no engineering costing handoff. Unlike
-- convertQuotationToPurchaseOrder (the only prior purchase_orders writer),
-- this creates a STANDALONE row -- quotation_id stays NULL -- so there is no
-- source quotation to snapshot pricing/items/dates from; the encoding wizard
-- computes everything client-side (lib/sales/purchase-orders.ts
-- encodeExistingPurchaseOrder) and hands it to fn_encode_existing_po below to
-- write in one transaction, mirroring the atomic-RPC precedent set by
-- migrations/0025_atomic_quotation_po_resubmit.sql for the same reason: a
-- multi-step client-side write here would risk the same kind of stuck/partial
-- record that migration fixed.
--
-- Two schema changes make a standalone PO possible:
--   1. purchase_orders gains an explicit audit trail (is_manually_encoded /
--      encoded_by / encoded_at) rather than seeding synthetic po_approvals
--      rows -- a fake approver/role would misrepresent who actually approved
--      it, when nobody did; this was a real approval-less backfill.
--   2. po_payments.po_id (a legacy FK to quotations.id, kept only for
--      column-name continuity with payments recorded before purchase_orders
--      existed as a separate table -- see the SECTION 4b comment above it)
--      must become nullable: a standalone PO has no quotation_id, so a
--      backfilled historical payment against it has nothing to put in po_id.
--      All runtime logic already keys on purchase_order_id instead (reads,
--      recompute, ownership guards in lib/sales/purchase-orders.ts), so this
--      is safe.

BEGIN;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS is_manually_encoded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encoded_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS encoded_at TIMESTAMPTZ;

ALTER TABLE public.po_payments
  ALTER COLUMN po_id DROP NOT NULL;

-- Inserts one standalone purchase order + its line items + (optionally) its
-- historical payments in a single transaction. Pricing is computed entirely
-- in TypeScript before calling this (computeLandedUnitCost, computeSalesPricing,
-- computeAggregatePricing -- same helpers every other pricing surface uses);
-- this function only writes the already-priced rows it's given. po_number
-- uniqueness is enforced by the table's existing UNIQUE constraint -- a
-- duplicate raises a normal 23505 for the caller to catch, same as the
-- retry-driven check in convertQuotationToPurchaseOrder.
CREATE OR REPLACE FUNCTION public.fn_encode_existing_po(
  p_po JSONB,
  p_items JSONB,
  p_payments JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_po_id UUID;
  v_po_date DATE;
  v_selling_amount NUMERIC(15, 2);
  v_item JSONB;
  v_payment JSONB;
  v_recognized_amount NUMERIC(15, 2) := 0;
  v_payment_status payment_status_enum;
BEGIN
  -- SECURITY DEFINER bypasses RLS, so the department/active check that
  -- sales_purchase_orders_sales_all would normally enforce on a plain INSERT
  -- has to be re-asserted here explicitly.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND department = 'sales' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Only active sales department users can encode purchase orders.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required.';
  END IF;

  v_po_date := COALESCE((p_po->>'po_date')::DATE, CURRENT_DATE);
  v_selling_amount := (p_po->>'selling_amount')::NUMERIC;

  INSERT INTO public.purchase_orders (
    po_number, client_id, sector, subject, po_amount, cost,
    margin_percentage, margin_amount, bank_percentage, bank_amount,
    sop_percentage, sop_amount, selling_amount, has_unequal_margins,
    payment_terms, payment_terms_custom, lead_time_days, client_po_number,
    quotation_reference, status, po_date, approved_at, submitted_at,
    created_by, is_manually_encoded, encoded_by, encoded_at
  ) VALUES (
    p_po->>'po_number',
    (p_po->>'client_id')::UUID,
    (p_po->>'sector')::sector_enum,
    p_po->>'subject',
    v_selling_amount,
    (p_po->>'cost')::NUMERIC,
    (p_po->>'margin_percentage')::NUMERIC,
    (p_po->>'margin_amount')::NUMERIC,
    (p_po->>'bank_percentage')::NUMERIC,
    (p_po->>'bank_amount')::NUMERIC,
    (p_po->>'sop_percentage')::NUMERIC,
    (p_po->>'sop_amount')::NUMERIC,
    v_selling_amount,
    COALESCE((p_po->>'has_unequal_margins')::BOOLEAN, FALSE),
    p_po->>'payment_terms',
    p_po->>'payment_terms_custom',
    (p_po->>'lead_time_days')::INTEGER,
    p_po->>'client_po_number',
    p_po->>'quotation_reference',
    'approved',
    v_po_date,
    v_po_date::TIMESTAMPTZ,
    v_po_date::TIMESTAMPTZ,
    v_user_id,
    TRUE,
    v_user_id,
    NOW()
  )
  RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.purchase_order_items (
      purchase_order_id, description, quantity, raw_cost, unit_cost, sort_order,
      margin_percentage, margin_amount, bank_percentage, bank_amount,
      sop_percentage, sop_amount, selling_amount
    ) VALUES (
      v_po_id,
      v_item->>'description',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'raw_cost')::NUMERIC,
      (v_item->>'unit_cost')::NUMERIC,
      COALESCE((v_item->>'sort_order')::INTEGER, 0),
      (v_item->>'margin_percentage')::NUMERIC,
      (v_item->>'margin_amount')::NUMERIC,
      (v_item->>'bank_percentage')::NUMERIC,
      (v_item->>'bank_amount')::NUMERIC,
      (v_item->>'sop_percentage')::NUMERIC,
      (v_item->>'sop_amount')::NUMERIC,
      (v_item->>'selling_amount')::NUMERIC
    );
  END LOOP;

  IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      INSERT INTO public.po_payments (
        purchase_order_id, po_id, amount_collected, payment_date,
        payment_method, reference_number, notes, recorded_by, proof_path
      ) VALUES (
        v_po_id,
        NULL, -- no source quotation to attribute the legacy po_id FK to.
        (v_payment->>'amount_collected')::NUMERIC,
        COALESCE((v_payment->>'payment_date')::DATE, CURRENT_DATE),
        v_payment->>'payment_method',
        v_payment->>'reference_number',
        v_payment->>'notes',
        v_user_id,
        v_payment->>'proof_path'
      );
      v_recognized_amount := v_recognized_amount + (v_payment->>'amount_collected')::NUMERIC;
    END LOOP;

    v_payment_status := CASE
      WHEN v_recognized_amount <= 0 THEN 'unpaid'
      WHEN v_recognized_amount < v_selling_amount THEN 'partial'
      ELSE 'paid'
    END;

    UPDATE public.purchase_orders
    SET recognized_amount = v_recognized_amount,
        payment_status = v_payment_status
    WHERE id = v_po_id;
  END IF;

  RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_encode_existing_po(JSONB, JSONB, JSONB) TO authenticated;

-- Deletes a manually-encoded PO (and its items/payments, via ON DELETE
-- CASCADE) so a mis-encoded record can be cleanly removed and re-entered.
-- Guards is_manually_encoded = TRUE itself, rather than trusting the caller,
-- so this can never be used to delete a real workflow PO -- those have no
-- delete path anywhere else in the app.
CREATE OR REPLACE FUNCTION public.fn_delete_encoded_po(p_po_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_encoded BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND department = 'sales' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Only active sales department users can delete an encoded purchase order.';
  END IF;

  SELECT is_manually_encoded INTO v_is_encoded
  FROM public.purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found.';
  END IF;

  IF NOT v_is_encoded THEN
    RAISE EXCEPTION 'Only manually-encoded purchase orders can be deleted this way.';
  END IF;

  DELETE FROM public.purchase_orders WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_delete_encoded_po(UUID) TO authenticated;

COMMIT;
