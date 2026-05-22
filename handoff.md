# Handoff — Client Requirements Rework (May 2026)

> Multi-module rework delivered **phase-by-module**; the user confirms each phase before moving on.
> As of this handoff, **Phases 1–4 are built and working in the tree but UNCOMMITTED**. Migrations `0001`–`0003` are untracked.

## ⚠️ First things to know

- **Nothing from this rework is committed yet.** `git status` shows ~27 modified files + untracked (`components/sales/`, `components/ui/number-input.tsx`, `lib/sales/dashboard-charts.ts`, `lib/sales/pricing.ts`, `lib/utils/number-format.ts`, `migrations/`). Decide with the user whether to commit Phases 1–4 before starting Phase 5.
- **Supabase MCP was flaky** in earlier sessions (timeouts). If `apply_migration` (Management API) times out, try `execute_sql` (direct DB), or vice versa. Migrations 0001–0003 were applied to the remote DB successfully and mirrored into `schema.sql`.
- Schema source of truth = `schema.sql` (mirror every migration into it).
- Run `npm run lint` and `npm run test` before committing — the test fixture `tests/unit/sales-table-performance.test.tsx` was updated for new required client fields.

## Done so far

### Phase 1 — Quotation flow + comma formatting ✅ (migration `0001`)
- `amount` = computed **`selling_amount`** = `direct_cost + margin_amount + bank_amount + sop_amount`. Costing phase captures only `cost`; sales phase computes selling_amount and sets `quotations.amount := selling_amount`. Keeps the ≥3M approval threshold, revenue targets, and KPI views working unchanged. During costing, `amount` stays 0.
- `margin_amount` dropped as generated col, re-added as real input-driven col (`cost * margin_percentage / 100`). `margin_percent` (overall %) left generated/intact. `lib/executive/dashboard.ts` reads `margin_amount` as a plain number — still works.
- Comma formatting: `lib/utils/number-format.ts` + `components/ui/number-input.tsx` (`NumberInput`). See pricing math in `lib/sales/pricing.ts`.

### Phase 2 — PO workflow reversal ✅ (migration `0002`)
- Re-added a **separate `purchase_orders` table** (extended the empty legacy table) + new **`po_approvals`** table mirroring `quotation_approvals` (shared ≥3M role thresholds via `requiredApproverRolesForAmount` / `findApproversForRole`, now **exported from `lib/sales/quotations.ts`**).
- Flow: approved quotation → **"Record Client PO"** (sets `client_po_number` / `client_confirmed_at`, re-opens editing) → **"Convert to Purchase Order"** (snapshots into `purchase_orders`, status `pending`, creates `po_approvals`) → approvals (sales_manager in PO module; owner/executive on Executive Approvals page) → fully approved PO shows in PO module; its quotation is filtered out of the Quotation module (via `converted_po_id` + `convertedPoStatus === 'approved'`).
- Collections moved to POs: `po_payments.purchase_order_id` (new); legacy `po_payments.po_id` → quotations retained.
- Owner/executive can reach `/protected/sales/purchase-orders` (`lib/sales/access.ts` widened).
- Key files: `lib/sales/purchase-orders.ts`, `app/protected/sales/purchase-orders/{actions.ts,page.tsx}`, `components/executive/po-approvals-table.tsx`, `components/dialogs/purchase-order-details-dialog.tsx`, `app/protected/executive/approvals/page.tsx`.

### Phase 3 — Sales dashboard charts ✅ (no migration)
- Two charts on `/protected/sales`, fed by approved sales-phase quotations: **Sector Performance** (SVG donut by client sector: commercial/industrial/solar) and **Client Quotation Distribution** (horizontal bars, value per client, top 8 + "Others").
- Data: `lib/sales/dashboard-charts.ts::getSalesDashboardCharts()`. Components: `components/sales/sector-performance-chart.tsx`, `components/sales/client-distribution-chart.tsx`.
- **No chart library** — hand-rolled SVG/CSS using existing `--chart-*` tokens (matches the minimal-UI convention).

### Phase 4 — Client module ✅ (migration `0003`)
- Added `clients.tin` (the "tim" in spec = TIN/Taxpayer ID, confirmed) and `clients.bir_registration_link` (manual URL paste).
- Wired through `lib/sales/clients.ts`, `app/protected/sales/clients/actions.ts`, create-client + client-details dialogs (edit + read-only "View document" link), and clients-table search.
- **NOT uppercased** (clients module never followed the uppercase convention; URL must stay intact).

## File-storage decision (applies repo-wide)
No app-level Google Drive integration exists. `google_drive_link` / `bir_registration_link` are just pasted text URL fields. Auto-upload of BIR PDFs is **deferred** — only build real upload (Supabase Storage or GCP service account) if the user explicitly asks.

## Next: Phase 5 — Executive metrics (NOT STARTED)
- The executive dashboard still reads **approved sales quotations** (`lib/executive/dashboard.ts`) — intentionally untouched until Phase 5.
- Open question for the user: should executive KPIs/revenue now read from **approved purchase_orders** instead of approved quotations (now that POs are the canonical post-approval record)? Confirm before changing, since this affects the ≥3M threshold/targets/KPI semantics.
- Confirm exact Phase 5 scope with the user before coding (this rework is strictly phase-by-phase with sign-off).

## Conventions to keep
- Server-side data fetching only (`createClient()` from `lib/supabase/server.ts`); mutations via `actions.ts` Server Actions with `useActionState`.
- Uppercase free-text inputs in the costing/quotation workflow (commit `5484b32`) — but NOT clients module, NOT URLs.
- Numeric inputs use `NumberInput`; currency displays use `Intl.NumberFormat("en-PH", { style:"currency", currency:"PHP" })`.
- Approval state machine + thresholds: `lib/sales/approval-workflow.ts` (`determineNextQuotationStatus`), tested in `tests/unit/approval-workflow.test.ts` — update tests if thresholds/roles change.
