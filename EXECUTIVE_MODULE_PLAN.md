# Executive Module — Fixes & Enhancements

## Context

Four issues were reported in the **Executive module** (scope is strictly this module; shared
data-loaders are touched only additively where explicitly approved). Each is a real defect or a
requested feature:

1. **Dashboard / Targets bug** — saving a *quarterly* target shows "Failed to load yearly target."
   Root cause: `upsertAnnualTarget`/`upsertQuarterlyTarget` use `onConflict: "year,month,sector"`,
   but Postgres treats the `NULL` `month`/`sector` as *distinct*, so every save **inserts a new row**
   instead of updating. Once ≥2 annual rows exist, `getAnnualTarget` (which uses `.maybeSingle()`
   with no `.limit(1)`) errors on "multiple rows", and that error is surfaced when a quarterly save
   calls it as a precondition. The dashboard KPI card doesn't break because its *separate* loader
   (`fetchAnnualTarget` in `dashboard.ts`) already defends with `.order(updated_at desc).limit(1)`.

2. **Revenue Breakdown (Monthly view)** — hardcoded to the real current month, with no month label
   and no way to view other months.

3. **Sales Performance Overview** — only owners with an approved PO in the period appear, and when a
   profile has no `full_name` the row shows `Owner <uuid-fragment>` instead of a name.

4. **Approvals / Costing approvals** — desktop tables need horizontal scroll (`min-w-[920–1080px]`)
   because the inline reason-input + action columns are wide; there is no per-item detail view.

**Confirmed decisions:** owner = **email username** (`email.split("@")[0]`); approval dialogs =
**enriched** (extend the shared sales loaders additively); month control = **dropdown** defaulting to
and marking the current month.

No database migration is required — the duplicate-row problem is fixed in application code and
self-heals existing duplicates on the next save.

---

## Issue 1 — Quarterly targets bug

**File:** `lib/executive/targets.ts`

- **Harden the read** `getAnnualTarget(year)` — add `.order("updated_at", { ascending: false }).limit(1)`
  before `.maybeSingle()`, mirroring `executiveDashboardQueries.fetchAnnualTarget` in
  `lib/executive/dashboard.ts:132`. This stops the error even while duplicate rows still exist.
- **Fix the root cause & self-heal** — replace the `onConflict`-based upserts in `upsertAnnualTarget`
  and `upsertQuarterlyTarget` with an explicit read-then-write that does not rely on the unique
  constraint over NULL columns:
  1. `select id` for rows matching `(year, month IS NULL|=month, sector IS NULL)`, ordered
     `updated_at desc`.
  2. If one or more exist → `update` the newest by `id` (set `target_amount`, `set_by`, `updated_at`),
     and `delete` any extra duplicate ids to clean up historical duplicates.
  3. If none exist → `insert`.
  Keep all existing validation/guards (`validateAnnualTargetInput`, annual-vs-quarter-sum checks,
  auth check). Preserve return shapes.
- `getQuarterlyTargets` already tolerates duplicates (map keyed by month); no change needed beyond
  the dedupe that the fixed upsert provides.

---

## Issue 2 — Revenue Breakdown month dropdown (Monthly view only)

**Files:** `lib/executive/dashboard.ts`, `app/protected/executive/sales/page.tsx`, new
`components/executive/revenue-month-select.tsx`.

- `dashboard.ts`:
  - Add optional `breakdownMonth?: number` to `ExecutiveDashboardQueryOptions`.
  - `buildRevenueBreakdownFromRows(...)` — add an optional `targetMonth` param (default
    `referenceDate.getMonth() + 1`) and use it for the **weekly** bucketing instead of the hardcoded
    `currentMonth` (`dashboard.ts:233,252`). Backward-compatible (existing tests pass no extra arg).
  - `getExecutiveRevenueBreakdown(...)` — pass `options.breakdownMonth` through as `targetMonth`.
    (Do **not** shift `referenceDate` — that would wrongly move PO summary / performance ranges.)
- `sales/page.tsx`:
  - Parse a `month` search param (clamp to `1..currentMonth` of the current year; default =
    current month). Pass `{ breakdownMonth: month }` into `getExecutiveDashboardData`.
  - When `selectedPeriod === "monthly"`, render `<RevenueMonthSelect>` in the Revenue Breakdown card
    header and set the card description/heading to the selected month name, marking the current month
    (e.g. "September 2026 · current").
- `revenue-month-select.tsx` (new, client): a shadcn `Select` (`components/ui/select.tsx`) listing
  Jan→current month; on change, `router.push` to
  `/protected/executive/sales?period=monthly&month=<n>` (preserve period). The current month option is
  labelled "(current)". Quarterly/YTD views are unchanged.

---

## Issue 3 — Sales Performance Overview (everyone in sales + email username)

**File:** `lib/executive/dashboard.ts` (page already renders `row.ownerName` — no UI change needed).

- Add `executiveDashboardQueries.fetchSalesRoster()` — select `id, email, full_name` from `profiles`
  where `department = 'sales' AND is_active = true` (same filter as `listSalesPeople` in
  `lib/engineering/sales-people.ts`). Map each to `{ ownerId, ownerName: email.split("@")[0] }`.
- Replace/augment `fetchProfileNames` with `fetchProfileUsernames(ids)` — select `id, email` for any
  owner ids **not** already in the roster (e.g. a manager who created a PO), mapping to email username.
- `getExecutiveSalesPerformance(...)` — fetch roster + PO rows in parallel; build a combined id→username
  map (roster ∪ extra owner usernames); call
  `buildSalesPerformanceFromRows(rows, usernameMap, roster)`.
- `buildSalesPerformanceFromRows(rows, nameMap, seedOwners?)` — add optional `seedOwners` param:
  seed the aggregate with every roster owner at 0 revenue/margin so **everyone in sales appears**.
  Change the unresolved-owner fallback from `` `Owner ${id.slice(0,8)}` `` to `"Unknown"` (never the
  UUID); `"unassigned"` → `"Unassigned"` stays. Existing sort (revenue desc, then name) keeps
  zero-revenue people at the bottom.
- **Update tests:** `tests/unit/executive/sales-performance.test.ts` — the "fallback labels" case
  currently expects the owner name to `.toContain("Owner")`; change it to expect `"Unknown"` (the
  intentional new behavior). The ranking test (2-arg call) stays valid.

---

## Issue 4 — Approvals responsiveness + detail dialogs

**Pattern (applied to all three tables):** slim the desktop `<table>` to a few essential columns and
**drop the `min-w-[...]`** so it fits without horizontal scroll; make each desktop `<tr>`
(`role="button" tabIndex onClick onKeyDown cursor-pointer`) and each mobile `<DataCard onActivate>`
open a per-item **detail dialog** that shows the enriched fields and hosts the Approve / Reject
(reason `Input`) actions. Model the dialogs on `components/dialogs/costing-quotation-details-dialog.tsx`
(`Dialog` → `DialogContent max-w-xl max-h-[85vh] overflow-y-auto`, `dl grid-cols-[140px_1fr]`,
`Callout` for reasons, footer buttons) and reuse `formatCurrency`, `StatusBadge`, `Callout`,
`ExternalLink`. Each table keeps its existing action handlers/role gating and holds `selectedItem`
state, rendering one dialog after `<ResponsiveTable>`; the dialog owns its local reason-input state.

**Enrich the shared loaders (additive — approved):**
- `lib/sales/quotations.ts` — extend `PendingApprovalItem` with optional `clientName`, `cost`,
  `marginAmount`, `sector`, `googleDriveLink`, `notes`, `createdAt`; expand the
  `listPendingApprovalsForCurrentUser` join select
  (`quotations:quotation_id(..., cost, margin_amount, sector, google_drive_link, notes, created_at,
  clients:client_id(company_name))`). Sales-module consumers render a subset → unaffected.
- `lib/sales/purchase-orders.ts` — extend `PendingPoApprovalItem` with optional `clientName`, `cost`,
  `marginAmount`, `sector`, `poDate`; expand the `listPendingPoApprovalsForCurrentUser` join select.
- Costing (`CostingApprovalItem`) already carries client/cost/drive/preparer/notes/createdAt — no
  loader change.

**Components:**
- `components/executive/approvals-table.tsx` — slim columns to Quotation · Subject · Amount · Required
  Role; add row-click → new `components/executive/approval-details-dialog.tsx`.
- `components/executive/po-approvals-table.tsx` — same treatment → new
  `components/executive/po-approval-details-dialog.tsx`.
- `components/executive/costing-approvals-table.tsx` — slim columns to Quotation · Client · Amount ·
  Prepared By; move Cost/Drive/Notes/Created + reason input + Approve/Reject/Dismiss into new
  `components/executive/costing-approval-details-dialog.tsx`.
- Buttons inside any still-clickable region must `stopPropagation`; simplest is to keep the row body
  clickable and place all actions inside the dialog only.

---

## Verification

- `npm run lint` and `npm run test` (must stay green; especially
  `tests/unit/executive/*` and `tests/unit/approval-workflow.test.ts`). Note: two **pre-existing**
  `tsc --noEmit` errors in unrelated vitest files are not introduced by this work.
- Manual (dev server, logged in as an executive) at `/protected/executive`:
  1. **Targets:** set an annual target, change it twice, then save each quarterly target — no
     "Failed to load yearly target"; quarterly values persist and re-display.
  2. **Sales → Revenue Breakdown:** switch to Monthly; the dropdown shows the current month marked;
     pick an earlier month and confirm the weekly bars re-bucket for that month.
  3. **Sales → Performance Overview:** every active salesperson appears (zero-revenue at the bottom);
     owners display as the email username, never a UUID.
  4. **Approvals & Costing approvals:** tables fit with no horizontal scroll at tablet/laptop widths;
     clicking a row (or card) opens a detail dialog with the enriched fields; Approve/Reject from the
     dialog works and the list refreshes.
