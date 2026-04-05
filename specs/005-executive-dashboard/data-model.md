# Data Model: Executive Dashboard

**Feature**: [spec.md](./spec.md)
**Date**: 2026-04-05

## Primary Tables (Existing)

### `public.profiles`

- Key fields used
  - `id` (UUID)
  - `full_name` (TEXT)
  - `department` (department_enum)
  - `role` (user_role_enum)
  - `is_executive_viewer` (BOOLEAN)
  - `is_active` (BOOLEAN)
- Purpose in this feature
  - Gate access to the Executive Dashboard.
  - Resolve PO owner display names for the sales performance ranking.

### `public.purchase_orders`

- Key fields used
  - `po_amount` (NUMERIC) — booked revenue (total PO value)
  - `cost` (NUMERIC)
  - `margin_amount` (generated)
  - `margin_percent` (generated)
  - `po_date` (DATE)
  - `created_by` (UUID → profiles.id)
  - `sector` (sector_enum)
- Purpose in this feature
  - Source of truth for booked revenue, margin calculations, and PO totals.
  - Drives:
    - Revenue YTD (sum `po_amount` within YTD)
    - Weighted margin % YTD (sum `margin_amount` / sum `po_amount`)
    - Revenue breakdown by month/quarter (group by `po_date` month/quarter)
    - Sales performance overview (group by `created_by`)
    - PO totals + margin summary (count + sums for selected period)

### `public.revenue_targets`

- Key fields used
  - `year` (INTEGER)
  - `month` (INTEGER NULL) — NULL indicates annual target
  - `sector` (sector_enum NULL) — NULL indicates overall target
  - `target_amount` (NUMERIC)
  - `set_by` (UUID → profiles.id)
- Purpose in this feature
  - Stores the **single overall annual target** for v1.
  - Dashboard reads row where `year = currentYear AND month IS NULL AND sector IS NULL`.

## Derived / Aggregated Views (Existing, Optional)

### `public.vw_po_summary`

- Provides PO rows including `margin_amount` and `margin_percent` plus date-derived year/month/quarter.
- Can be used to simplify some read queries, but v1 can query `purchase_orders` directly.

## New/Updated Authorization Requirements

### Revenue target editing

To support Story 2 (edit yearly target), database authorization must allow:

- SELECT for Executive Dashboard Viewers: profiles.is_executive_viewer = TRUE AND profiles.is_active = TRUE
- INSERT / UPDATE for Target Editors only: profiles.role IN ('owner','executive') AND profiles.is_active = TRUE

This requires adding RLS policies for `public.revenue_targets` for INSERT and UPDATE (and possibly DELETE if the UX supports removing targets).

## Metric Definitions (for consistent implementation)

- **Revenue YTD (booked)**: sum of `purchase_orders.po_amount` where `po_date` is between Jan 1 and today (inclusive) for the current year.
- **Annual target**: `revenue_targets.target_amount` where `(year=currentYear AND month IS NULL AND sector IS NULL)`.
- **Average Overall Margin (YTD)**: weighted margin % over YTD booked revenue:
  - $\frac{\sum margin\_amount}{\sum po\_amount} \times 100$.
- **Monthly breakdown**: group booked revenue by month in the selected year.
- **Quarterly breakdown**: group booked revenue by quarter in the selected year.
- **Sales performance overview**: group by `purchase_orders.created_by` for selected period; rank descending by booked revenue.
- **PO totals + margin summary**: for selected period, compute PO count, sum `po_amount`, sum `margin_amount`.
