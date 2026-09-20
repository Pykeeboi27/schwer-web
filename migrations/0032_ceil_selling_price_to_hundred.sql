-- Backfills existing priced quotations/purchase orders under the new
-- selling-price rule: the printed/stored Selling price ceilings up to the
-- nearest ₱100 (e.g. 7562.79 -> 7600.00), matching the original source
-- costing worksheet's rule and lib/sales/pricing.ts's updated
-- computeSalesPricing. The gap this opens up versus the exact
-- cost+margin+bank waterfall is folded entirely into sop_amount, so the
-- parts still sum exactly to the new selling_amount.
--
-- Mirrors computeSalesPricing's waterfall stage by stage (verified against
-- the live TypeScript implementation on three real production rows spanning
-- different quantities/margin-bank-sop combos before this migration was
-- written -- all three matched to the centavo). Only items where at least
-- one of margin/bank/sop_percentage is set are recomputed (matches
-- repriceStoredItems's "isPriced" rule); legacy unpriced items are left
-- untouched. unit_cost/line_total (the cost side) are NOT touched here --
-- only the selling-side amounts derived from the already-existing
-- line_total.
--
-- Runs as plain UPDATEs (verified safe against schema.sql): `quotations` has
-- only trg_audit_quotations (one audit-log row per changed record -- accept
-- this, same precedent as the prior cost-side migration: a restated selling
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
      ROUND(unit_after_sop_exact, 2) AS unit_selling_amount
    FROM unit_after_sop
  ),
  line_amounts AS (
    SELECT
      *,
      ROUND(unit_after_margin * qty, 2) AS line_after_margin,
      ROUND(unit_after_bank * qty, 2) AS line_after_bank,
      ROUND(unit_selling_amount * qty, 2) AS exact_selling_amount
    FROM rounded
  )
  SELECT
    id,
    ROUND(line_after_margin - line_cost, 2) AS margin_amount,
    ROUND(line_after_bank - line_after_margin, 2) AS bank_amount,
    ROUND(
      exact_selling_amount - line_after_bank +
      ROUND(CEIL(exact_selling_amount / 100) * 100 - exact_selling_amount, 2),
      2
    ) AS sop_amount,
    (CEIL(exact_selling_amount / 100) * 100) AS selling_amount
  FROM line_amounts
) w
WHERE poi.id = w.id;

-- Step 2: roll the (now-updated) priced items up into each purchase_order --
-- po_amount/selling_amount become the sum of the already-ceiling'd lines,
-- and the blended margin/bank/sop percentages are recomputed the same way
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
      ROUND(unit_after_sop_exact, 2) AS unit_selling_amount
    FROM unit_after_sop
  ),
  line_amounts AS (
    SELECT
      *,
      ROUND(unit_after_margin * qty, 2) AS line_after_margin,
      ROUND(unit_after_bank * qty, 2) AS line_after_bank,
      ROUND(unit_selling_amount * qty, 2) AS exact_selling_amount
    FROM rounded
  )
  SELECT
    id,
    ROUND(line_after_margin - line_cost, 2) AS margin_amount,
    ROUND(line_after_bank - line_after_margin, 2) AS bank_amount,
    ROUND(
      exact_selling_amount - line_after_bank +
      ROUND(CEIL(exact_selling_amount / 100) * 100 - exact_selling_amount, 2),
      2
    ) AS sop_amount,
    (CEIL(exact_selling_amount / 100) * 100) AS selling_amount
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
