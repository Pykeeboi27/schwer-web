-- Fix: purchase_orders.margin_amount was inherited as a GENERATED column
-- (po_amount - cost) from the legacy table, which broke quotation -> PO
-- conversion ("cannot insert a non-DEFAULT value into column margin_amount").
--
-- Phase 1 made quotations.margin_amount an input-driven snapshot
-- (cost * margin_percentage / 100); purchase_orders must mirror that so the
-- conversion can snapshot the quotation's margin and so Phase 5 executive
-- metrics read a consistent margin definition.
--
-- DROP EXPRESSION converts the generated column to a normal base column while
-- preserving existing values (Postgres 13+). margin_percent stays GENERATED.

ALTER TABLE public.purchase_orders
  ALTER COLUMN margin_amount DROP EXPRESSION;
