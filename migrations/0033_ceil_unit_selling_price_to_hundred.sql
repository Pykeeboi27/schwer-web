-- Moves the ₱100 ceiling from the LINE selling price to the PER-UNIT selling
-- price, and backfills existing priced quotations/purchase orders under the
-- new rule.
--
-- Migration 0032 applied the source costing worksheet's "round up to the
-- nearest ₱100" rule to the line total (selling_amount), deliberately leaving
-- the per-unit price at centavo precision. That broke the natural relationship
-- between the two printed columns -- qty x unit price no longer footed to the
-- line total, which reads as an arithmetic error on the worksheet (column M x
-- column P <> column R).
--
-- Per product decision the ceiling now applies per unit instead: the per-unit
-- selling price rounds UP to the nearest ₱100, and the line selling price is
-- simply that ceiling'd unit price times quantity, with no second ceiling of
-- its own. So unit x qty = line exactly and the worksheet foots. The bump the
-- ceiling opens up versus the exact waterfall is still folded entirely into
-- sop_amount, so cost + margin + bank + sop continues to sum exactly to
-- selling_amount.
--
-- Accepted consequence: inexpensive items are distorted upward -- a unit price
-- working out to ₱72.10 prices at ₱100.00. This is the client's trade-off for
-- a clean per-unit figure, not an oversight.
--
-- Mirrors lib/sales/pricing.ts's updated computeSalesPricing stage by stage.
-- One deliberate difference from the TypeScript: ROUND(..., 6) before the
-- CEIL stands in for the TS helper's toPrecision(12) cleanup. The TS needs it
-- because IEEE754 turns an exact 100 into 99.99999999999999; Postgres NUMERIC
-- has no such noise, but the guard keeps a value sitting a hair above a clean
-- hundred from ceiling'ing to the next one and diverging from the app.
--
-- Only items where at least one of margin/bank/sop_percentage is set are
-- recomputed (matches repriceStoredItems's "isPriced" rule); legacy unpriced
-- items are left untouched. unit_cost/line_total (the cost side) are NOT
-- touched here -- only the selling-side amounts derived from the already-
-- existing line_total. There is no unit_selling_amount column: the per-unit
-- figure is derived at read time, so only selling_amount/sop_amount and the
-- parent rollups need restating.
--
-- Runs as plain UPDATEs (verified safe against schema.sql, unchanged since
-- 0032): `quotations` has only trg_audit_quotations (one audit-log row per
-- changed record -- accept this, same precedent as 0032: a restated selling
-- price should leave a trail) and trg_updated_at_quotations;
-- `purchase_orders` has no triggers at all. Neither reacts to
-- amount/po_amount changes by resetting or re-firing the approval workflow,
-- so already-approved records' approval status/history is untouched -- only
-- the amount and the GENERATED requires_executive_approval/margin_percent
-- columns move.

BEGIN;

-- Step 1: recompute each priced purchase_order_item's margin/bank/sop/selling
-- amount from its stored line_total/quantity/percentages.
UPDATE purchase_order_items poi
SET margin_amount = w.margin_amount,
    bank_amount = w.bank_amount,
    sop_amount = w.sop_amount,
    selling_amount = w.selling_amount
FROM (
  WITH waterfall AS (
    SELECT
      id,
      line_total AS line_cost,
      quantity AS qty,
      LEAST(GREATEST(COALESCE(margin_percentage, 0), 0), 99.99) / 100 AS margin_rate,
      COALESCE(bank_percentage, 0) AS bank_pct,
      COALESCE(sop_percentage, 0) AS sop_pct
    FROM purchase_order_items
    WHERE margin_percentage IS NOT NULL
       OR bank_percentage IS NOT NULL
       OR sop_percentage IS NOT NULL
  ),
  exact_unit AS (
    SELECT
      *,
      CASE WHEN margin_rate > 0
        THEN (line_cost / qty) / (1 - margin_rate)
        ELSE (line_cost / qty)
      END AS unit_after_margin_exact
    FROM waterfall
  ),
  unit_after_bank AS (
    SELECT *, unit_after_margin_exact * (1 + bank_pct / 100) AS unit_after_bank_exact
    FROM exact_unit
  ),
  unit_after_sop AS (
    SELECT *, unit_after_bank_exact * (1 + sop_pct / 100) AS unit_after_sop_exact
    FROM unit_after_bank
  ),
  rounded AS (
    SELECT
      *,
      ROUND(unit_after_margin_exact, 2) AS unit_after_margin,
      ROUND(unit_after_bank_exact, 2) AS unit_after_bank,
      -- The ceiling now lands HERE, on the per-unit price.
      (CEIL(ROUND(unit_after_sop_exact, 6) / 100) * 100) AS unit_selling_amount
    FROM unit_after_sop
  ),
  line_amounts AS (
    SELECT
      *,
      ROUND(unit_after_margin * qty, 2) AS line_after_margin,
      ROUND(unit_after_bank * qty, 2) AS line_after_bank,
      -- ...so the line total is a plain multiplication, not a second ceiling.
      ROUND(unit_selling_amount * qty, 2) AS selling_amount
    FROM rounded
  )
  SELECT
    id,
    ROUND(line_after_margin - line_cost, 2) AS margin_amount,
    ROUND(line_after_bank - line_after_margin, 2) AS bank_amount,
    -- The remainder up to selling_amount: the true SOP% plus the per-unit
    -- rounding bump, so the four parts still sum exactly.
    ROUND(selling_amount - line_after_bank, 2) AS sop_amount,
    selling_amount
  FROM line_amounts
) w
WHERE poi.id = w.id;

-- Step 2: roll the (now-updated) priced items up into each purchase_order --
-- po_amount/selling_amount become the sum of the line totals, and the blended
-- margin/bank/sop percentages are recomputed the same way
-- computeAggregatePricing derives them (amount / total direct cost).
UPDATE purchase_orders po
SET po_amount = agg.selling_amount,
    selling_amount = agg.selling_amount,
    margin_amount = agg.margin_amount,
    bank_amount = agg.bank_amount,
    sop_amount = agg.sop_amount,
    margin_percentage = CASE WHEN agg.direct_cost > 0
      THEN ROUND((agg.margin_amount / agg.direct_cost) * 100, 2) ELSE 0 END,
    bank_percentage = CASE WHEN agg.direct_cost > 0
      THEN ROUND((agg.bank_amount / agg.direct_cost) * 100, 2) ELSE 0 END,
    sop_percentage = CASE WHEN agg.direct_cost > 0
      THEN ROUND((agg.sop_amount / agg.direct_cost) * 100, 2) ELSE 0 END
FROM (
  SELECT
    purchase_order_id,
    SUM(line_total) AS direct_cost,
    SUM(margin_amount) AS margin_amount,
    SUM(bank_amount) AS bank_amount,
    SUM(sop_amount) AS sop_amount,
    SUM(selling_amount) AS selling_amount
  FROM purchase_order_items
  WHERE margin_percentage IS NOT NULL
     OR bank_percentage IS NOT NULL
     OR sop_percentage IS NOT NULL
  GROUP BY purchase_order_id
) agg
WHERE po.id = agg.purchase_order_id;

-- Step 3/4: mirror the same two steps for quotations. Currently a no-op (no
-- quotation_items have any percentage set yet in this environment), but kept
-- symmetric with the purchase-order side for whenever the quotation-phase
-- pricing flow is used.
UPDATE quotation_items qi
SET margin_amount = w.margin_amount,
    bank_amount = w.bank_amount,
    sop_amount = w.sop_amount,
    selling_amount = w.selling_amount
FROM (
  WITH waterfall AS (
    SELECT
      id,
      line_total AS line_cost,
      quantity AS qty,
      LEAST(GREATEST(COALESCE(margin_percentage, 0), 0), 99.99) / 100 AS margin_rate,
      COALESCE(bank_percentage, 0) AS bank_pct,
      COALESCE(sop_percentage, 0) AS sop_pct
    FROM quotation_items
    WHERE margin_percentage IS NOT NULL
       OR bank_percentage IS NOT NULL
       OR sop_percentage IS NOT NULL
  ),
  exact_unit AS (
    SELECT
      *,
      CASE WHEN margin_rate > 0
        THEN (line_cost / qty) / (1 - margin_rate)
        ELSE (line_cost / qty)
      END AS unit_after_margin_exact
    FROM waterfall
  ),
  unit_after_bank AS (
    SELECT *, unit_after_margin_exact * (1 + bank_pct / 100) AS unit_after_bank_exact
    FROM exact_unit
  ),
  unit_after_sop AS (
    SELECT *, unit_after_bank_exact * (1 + sop_pct / 100) AS unit_after_sop_exact
    FROM unit_after_bank
  ),
  rounded AS (
    SELECT
      *,
      ROUND(unit_after_margin_exact, 2) AS unit_after_margin,
      ROUND(unit_after_bank_exact, 2) AS unit_after_bank,
      (CEIL(ROUND(unit_after_sop_exact, 6) / 100) * 100) AS unit_selling_amount
    FROM unit_after_sop
  ),
  line_amounts AS (
    SELECT
      *,
      ROUND(unit_after_margin * qty, 2) AS line_after_margin,
      ROUND(unit_after_bank * qty, 2) AS line_after_bank,
      ROUND(unit_selling_amount * qty, 2) AS selling_amount
    FROM rounded
  )
  SELECT
    id,
    ROUND(line_after_margin - line_cost, 2) AS margin_amount,
    ROUND(line_after_bank - line_after_margin, 2) AS bank_amount,
    ROUND(selling_amount - line_after_bank, 2) AS sop_amount,
    selling_amount
  FROM line_amounts
) w
WHERE qi.id = w.id;

UPDATE quotations q
SET amount = agg.selling_amount,
    selling_amount = agg.selling_amount,
    margin_amount = agg.margin_amount,
    bank_amount = agg.bank_amount,
    sop_amount = agg.sop_amount,
    margin_percentage = CASE WHEN agg.direct_cost > 0
      THEN ROUND((agg.margin_amount / agg.direct_cost) * 100, 2) ELSE 0 END,
    bank_percentage = CASE WHEN agg.direct_cost > 0
      THEN ROUND((agg.bank_amount / agg.direct_cost) * 100, 2) ELSE 0 END,
    sop_percentage = CASE WHEN agg.direct_cost > 0
      THEN ROUND((agg.sop_amount / agg.direct_cost) * 100, 2) ELSE 0 END
FROM (
  SELECT
    quotation_id,
    SUM(line_total) AS direct_cost,
    SUM(margin_amount) AS margin_amount,
    SUM(bank_amount) AS bank_amount,
    SUM(sop_amount) AS sop_amount,
    SUM(selling_amount) AS selling_amount
  FROM quotation_items
  WHERE margin_percentage IS NOT NULL
     OR bank_percentage IS NOT NULL
     OR sop_percentage IS NOT NULL
  GROUP BY quotation_id
) agg
WHERE q.id = agg.quotation_id;

COMMIT;
