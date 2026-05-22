-- Phase 1: Quotation flow updates
--
-- Costing now captures only `cost` (direct cost); `amount` becomes the
-- selling amount computed in the sales phase as:
--   selling_amount = direct_cost + margin_amount + bank_amount + sop_amount
-- and `amount` is set to selling_amount when the sales user prices the quote.
--
-- The previously generated `margin_amount` column conflicts with the new
-- input-driven margin model, so it is dropped and re-added as a real column.
-- (`lib/executive/dashboard.ts` reads margin_amount as a plain number; it keeps
-- working since the column still holds the margin in PHP.)
-- The generated `margin_percent` column is left intact (overall margin %).

BEGIN;

-- amount no longer required at costing time; default 0 until sales prices it.
ALTER TABLE public.quotations ALTER COLUMN amount SET DEFAULT 0;

-- Replace the generated margin_amount with a real, input-driven column.
ALTER TABLE public.quotations DROP COLUMN IF EXISTS margin_amount;
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS margin_amount      NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS bank_percentage    NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS bank_amount        NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS sop_percentage     NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS sop_amount         NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS selling_amount     NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS payment_terms_custom TEXT;

COMMIT;
