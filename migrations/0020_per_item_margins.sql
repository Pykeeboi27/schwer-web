-- Per-item Sales Margin/Bank/SOP pricing.
--
-- Margin %, Bank %, and SOP % used to apply once, to the whole quotation/PO
-- (quotations.margin_percentage etc., computed against the aggregate
-- quotations.cost). Sales now needs to price each line item individually,
-- with an "unequal margins" toggle: unticked applies one set of percentages
-- to every item, ticked lets each item carry its own.
--
-- These new *_percentage/*_amount columns on quotation_items and
-- purchase_order_items are plain columns (not GENERATED) because they'd need
-- to reference the already-GENERATED line_total column, which Postgres
-- disallows for generated columns. They're computed and written app-side by
-- lib/sales/pricing.ts (computeSalesPricing), mirroring how the existing
-- record-level margin_amount columns are input-driven snapshots rather than
-- DB-computed (see migration 0004).
--
-- The existing record-level margin/bank/sop/selling_amount columns on
-- quotations/purchase_orders are kept: on save they're now written as a
-- blended weighted-average (percentages) / summed rollup (amounts) across the
-- item rows, so every existing reader (executive dashboard, worksheet
-- exports, the >=3M approval threshold via `amount`) keeps working unchanged.
--
-- has_unequal_margins stores the tick-box state so the UI can tell whether an
-- item set was priced uniformly or individually.

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS margin_amount     NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS bank_percentage   NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS bank_amount       NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS sop_percentage    NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS sop_amount        NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS selling_amount    NUMERIC(15, 2);

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS margin_amount     NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS bank_percentage   NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS bank_amount       NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS sop_percentage    NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS sop_amount        NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS selling_amount    NUMERIC(15, 2);

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS has_unequal_margins BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS has_unequal_margins BOOLEAN NOT NULL DEFAULT FALSE;
