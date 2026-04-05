# Quickstart: Executive Dashboard

**Feature**: [spec.md](./spec.md)

## Prerequisites

- App configured to connect to Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- A test user with a `public.profiles` row where:
  - `is_active = true`
  - `is_executive_viewer = true` (or equivalent executive access)
- Seed data:
  - At least a few `purchase_orders` across multiple months/quarters in the current year.
  - A `revenue_targets` row for the current year where `month IS NULL` and `sector IS NULL`.

## Run Locally

- `npm install`
- `npm run dev`

## Manual Smoke Test

1. Sign in as an Executive Dashboard Viewer.
2. Navigate to the Executive Dashboard route (to be implemented under `/protected/executive`).
3. Verify KPI cards render:
   - Revenue YTD vs Target (booked revenue)
   - Average Overall Margin (YTD) (weighted)
4. Change the period filter:
   - Monthly → revenue breakdown shows monthly booked revenue for the year
   - Quarterly → revenue breakdown shows quarterly booked revenue for the year
   - Year-to-Date → overview sections show YTD breakdown/overview state
5. Verify Sales performance overview:
   - Ranked by PO owner
   - Shows revenue and margin
6. Verify PO totals + margin summary:
   - Shows PO count, total PO value, total margin
7. Edit yearly target (Target Editor):
   - Set a new target and confirm “Revenue YTD vs Target” updates.
8. Attempt target edit with a non-Target Editor:
   - Verify edit is blocked.

## Test Coverage Targets

- Unit: formatting/helpers + any calculation utilities.
- Integration: server-side data functions reading aggregated values for each filter.
- E2E: Executive Dashboard Viewer can view dashboard and switch filters; Target Editor can edit yearly target.
