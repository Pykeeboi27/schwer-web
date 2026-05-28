-- Free-text reference field for POs (e.g. internal project code or original
-- quotation number for manually created POs not linked via converted_po_id).
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS quotation_reference TEXT;
