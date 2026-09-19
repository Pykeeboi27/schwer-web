-- Rounds the landed unit cost to the centavo BEFORE multiplying by quantity,
-- so a manual per-unit costing sheet reconciles with line_total exactly
-- (unit_cost * quantity === line_total). Supersedes migration 0024's
-- "carry full precision, round once" rule: that mirrored the source Excel
-- template, but the client's own costing sheet works the other way --
-- Engineering rounds the landed unit cost to 2dp first, then multiplies by
-- quantity -- and the two conventions can differ by up to half a centavo
-- per unit (so up to a few pesos on a high-quantity line). Companion to the
-- selling-price fix in lib/sales/pricing.ts (computeSalesPricing), which
-- already rounds its own per-unit subtotals the same way.
--
-- Postgres can't ALTER a GENERATED column's expression in place, so this
-- drops and re-adds line_total on both tables (dropping a STORED generated
-- column and re-adding it recomputes every existing row automatically -- no
-- separate backfill needed for line_total itself). ROUND(numeric, 2) is
-- IMMUTABLE (legal in a generated column expression) and half-up
-- away-from-zero, matching lib/sales/pricing.ts's round2 -- raw_cost is
-- CHECK'd >= 0, so the away-from-zero-vs-half-up distinction never bites.
--
-- quotations.cost / purchase_orders.cost are NOT recomputed by the
-- ALTER TABLE itself -- fn_sync_quotation_cost_from_items (migrations/0008)
-- is a row trigger and does not fire on a column rewrite, and
-- purchase_orders.cost has no equivalent trigger at all (it's written by
-- copy). Both parent rollups below are therefore mandatory, or the parent
-- `cost` column would silently disagree with SUM(line_total) on every
-- affected record. margin_percent (GENERATED from cost) recomputes on its
-- own once cost is updated. quotations.amount / purchase_orders.po_amount /
-- *_amount / *_percentage columns are deliberately left untouched here --
-- every read path re-derives display pricing via repriceStoredItems
-- (lib/sales/pricing.ts), so this migration only needs to fix the
-- underlying line_total/cost figures those reads are based on.

BEGIN;

ALTER TABLE public.quotation_items DROP COLUMN line_total;
ALTER TABLE public.quotation_items ADD COLUMN line_total NUMERIC(15, 2)
  GENERATED ALWAYS AS (
    quantity * CASE
      WHEN raw_cost IS NOT NULL THEN ROUND(raw_cost * 1.03 * 1.015, 2)
      ELSE COALESCE(unit_cost, 0)
    END
  ) STORED;

ALTER TABLE public.purchase_order_items DROP COLUMN line_total;
ALTER TABLE public.purchase_order_items ADD COLUMN line_total NUMERIC(15, 2)
  GENERATED ALWAYS AS (
    quantity * CASE
      WHEN raw_cost IS NOT NULL THEN ROUND(raw_cost * 1.03 * 1.015, 2)
      ELSE COALESCE(unit_cost, 0)
    END
  ) STORED;

UPDATE public.quotations q
SET cost = s.total
FROM (
  SELECT quotation_id, SUM(line_total) AS total
  FROM public.quotation_items
  GROUP BY quotation_id
) s
WHERE q.id = s.quotation_id
  AND q.cost IS DISTINCT FROM s.total;

UPDATE public.purchase_orders po
SET cost = s.total
FROM (
  SELECT purchase_order_id, SUM(line_total) AS total
  FROM public.purchase_order_items
  GROUP BY purchase_order_id
) s
WHERE po.id = s.purchase_order_id
  AND po.cost IS DISTINCT FROM s.total;

COMMIT;
