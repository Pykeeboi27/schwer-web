-- Exact-decimal landed unit cost via the OPEX/delivery-fee waterfall.
--
-- The source Excel costing template never lets Engineering type the final
-- per-unit cost directly: they type a clean 2-decimal raw material+labor
-- figure (e.g. 2121.42), and the sheet automatically applies a fixed +3%
-- OPEX loading then a fixed +1.5% delivery fee (Q = P*1.03, R = Q*1.015),
-- carrying the (usually 6-7 decimal) result at full precision into the line
-- total, rounding only once, for display. The app instead only ever had a
-- single "Unit Cost" field, requiring Engineering to do that math themselves
-- in Excel and retype the *rounded* result -- which is why line_total drifted
-- from Excel's total by a fraction of a peso (rounding before multiplying by
-- quantity, instead of multiplying then rounding once like Excel does).
--
-- raw_cost is the new, additive input column. line_total is redefined to
-- compute straight from raw_cost * 1.03 * 1.015 * quantity (Postgres NUMERIC
-- arithmetic is exact decimal, so this reproduces Excel's total to the
-- centavo) when raw_cost is set, falling back to the old
-- quantity * unit_cost behavior otherwise. Every existing row has raw_cost
-- IS NULL, so recomputing line_total on this ALTER reproduces the exact same
-- values as before for all of them -- no backfill, no data changes for
-- already-priced items. unit_cost remains a plain, human-typed/written
-- column (now the *display* landed cost for new items, computed app-side by
-- lib/engineering/costing-quotations.ts::computeLandedUnitCost) and is no
-- longer part of line_total's generation once raw_cost is present.
--
-- Postgres can't ALTER a GENERATED column's expression in place, so this
-- drops and re-adds line_total on both tables.

BEGIN;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS raw_cost NUMERIC(15, 2) CHECK (raw_cost IS NULL OR raw_cost >= 0);

ALTER TABLE public.quotation_items DROP COLUMN line_total;
ALTER TABLE public.quotation_items ADD COLUMN line_total NUMERIC(15, 2)
  GENERATED ALWAYS AS (
    quantity * CASE
      WHEN raw_cost IS NOT NULL THEN raw_cost * 1.03 * 1.015
      ELSE COALESCE(unit_cost, 0)
    END
  ) STORED;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS raw_cost NUMERIC(15, 2) CHECK (raw_cost IS NULL OR raw_cost >= 0);

ALTER TABLE public.purchase_order_items DROP COLUMN line_total;
ALTER TABLE public.purchase_order_items ADD COLUMN line_total NUMERIC(15, 2)
  GENERATED ALWAYS AS (
    quantity * CASE
      WHEN raw_cost IS NOT NULL THEN raw_cost * 1.03 * 1.015
      ELSE COALESCE(unit_cost, 0)
    END
  ) STORED;

COMMIT;
