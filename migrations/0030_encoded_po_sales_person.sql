-- Lets the coordinator attribute a manually-encoded PO (migration 0027) to
-- the sales person the sale actually belongs to, instead of always stamping
-- created_by with the coordinator doing the encoding. encoded_by (added in
-- 0027) already tracks who performed the encoding for audit purposes, so
-- created_by is free to carry the real owner -- the same "who this record
-- belongs to" meaning it has everywhere else (see schema.sql's
-- sales_person_id/prepared_by/created_by comment on the notifications table).
--
-- CREATE OR REPLACE of the function from migrations/0029 -- everything
-- except the new p_po->>'sales_person_id' handling is unchanged.

BEGIN;

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
  v_sales_person_id UUID;
  v_po_id UUID;
  v_po_date DATE;
  v_selling_amount NUMERIC(15, 2);
  v_item JSONB;
  v_payment JSONB;
  v_recognized_amount NUMERIC(15, 2) := 0;
  v_payment_status payment_status_enum;
BEGIN
  -- SECURITY DEFINER bypasses RLS, so authorization is asserted here
  -- explicitly: only an active coordinator in the sales department may
  -- encode a backfilled purchase order.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id
      AND department = 'sales'
      AND role = 'coordinator'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Only the coordinator can encode existing purchase orders.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required.';
  END IF;

  v_sales_person_id := (p_po->>'sales_person_id')::UUID;
  IF v_sales_person_id IS NULL THEN
    RAISE EXCEPTION 'A sales person must be selected.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_sales_person_id
      AND department = 'sales'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Selected sales person is not an active sales department user.';
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
    v_sales_person_id,
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

COMMIT;
