# Implementation Plan: Executive Dashboard

**Branch**: `005-executive-dashboard` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)
**Input**: Executive KPI dashboard for leadership: Revenue YTD vs Target (editable yearly target), Average Overall Margin (YTD), revenue breakdown (quarter/month), sales performance overview, PO totals + margin summary; filters Monthly/Quarterly/Year-to-Date.

## Summary

Implement a protected Executive Dashboard route that is accessible only to Executive Dashboard Viewers and displays:

- **Revenue YTD vs Target** (booked revenue = sum of purchase_orders.po_amount)
- **Average Overall Margin (YTD)** (weighted margin %)
- **Revenue breakdown** by month or quarter (based on filter)
- **Sales performance overview** ranked by PO owner
- **PO totals + margin summary** for selected period

Data will be computed from existing tables (`purchase_orders`, `revenue_targets`, `profiles`) following established `lib/` Supabase server-client patterns.

Phase outputs:
- Phase 0: [research.md](./research.md)
- Phase 1: [data-model.md](./data-model.md), [contracts/executive-dashboard.contract.md](./contracts/executive-dashboard.contract.md), [quickstart.md](./quickstart.md)

## Technical Context

**Language/Version**: TypeScript (Next.js App Router / React)
**Primary Dependencies**: Next.js, Tailwind CSS, Supabase (SSR cookie auth), Lucide, existing shadcn/ui primitives
**Storage**: Supabase Postgres (canonical schema in `schema.sql`)
**Testing**: Unit + Integration + E2E
**Target Platform**: Web (evergreen browsers)
**Project Type**: Web application
**Performance Goals**:
- Dashboard should render within 3 seconds for 95% of loads (matches spec success criteria).
**Constraints**:
- No service-role keys in client.
- All access enforcement via Supabase Auth + RLS + server-side route gating.
- No new UI frameworks; adhere to existing tokens/components.
**Scale/Scope**:
- v1 supports a small number of executive users, current-year reporting, and a single overall annual target.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Fixed stack honored (Next.js + TypeScript + Tailwind + Lucide + Supabase): PASS
- Brand colors enforced via tokens only (no ad-hoc colors): PASS
- Supabase Auth used; RLS policies required for sensitive tables: PASS (requires adding write policies for `revenue_targets`)
- Database changes reflected in `schema.sql`: PASS (plan includes updating `schema.sql` if RLS policies are added)
- Test plan covers unit + integration + E2E: PASS

## Project Structure

### Documentation (this feature)

```text
specs/005-executive-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── executive-dashboard.contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
└── protected/
    └── executive/
        └── page.tsx

lib/
└── executive/
    ├── access.ts
    └── dashboard.ts

components/
└── (optional) executive/
    └── (dashboard-only UI pieces)

tests/
├── unit/
├── integration/
└── e2e/
```

**Structure Decision**:
- Create a dedicated route at `app/protected/executive/page.tsx` that mirrors the server-side gating style used by `app/protected/sales/page.tsx`.
- Implement executive access checks in `lib/executive/access.ts` using `CurrentProfile` and existing patterns (redirect to `/auth/login` or department dashboard).
- Keep all Supabase reads/writes and aggregation logic in `lib/executive/dashboard.ts` (server-only), returning typed data for the UI.

## Phase 0: Research (Completed)

See [research.md](./research.md).

Key outcomes:
- Revenue basis: booked revenue (sum of purchase_orders.po_amount)
- Margin: weighted margin % for YTD
- Target scope: overall annual target only
- Sales performance ranking: PO owner
- Prefer purchase orders as v1 source of truth

## Phase 1: Design (Completed)

### Data Model

See [data-model.md](./data-model.md).

Notable design implications:
- No new core entities required for v1.
- To support editing targets, add RLS policies for revenue_targets INSERT/UPDATE for Target Editors only (profiles.role IN ('owner','executive') AND profiles.is_active = TRUE).
- Ensure executive dashboard reads are allowed only for Executive Dashboard Viewers (profiles.is_executive_viewer = TRUE AND profiles.is_active = TRUE).
- Add a read-only RLS SELECT policy for public.purchase_orders that allows active Executive Dashboard Viewers (profiles.is_executive_viewer = TRUE AND is_active = TRUE) to read rows for dashboard aggregation; current schema grants Sales full access but does not grant Executive Dashboard Viewers read access.- Add a read-only RLS SELECT policy for public.purchase_orders that allows active executive viewers (profiles.is_executive_viewer = TRUE AND is_active = TRUE) to read rows for dashboard aggregation; current schema grants Sales full access but does not grant executive viewers read access.


### Contracts

See [contracts/executive-dashboard.contract.md](./contracts/executive-dashboard.contract.md).

### Quickstart

See [quickstart.md](./quickstart.md).

## Test Strategy

- **Unit**:
  - Currency/percent formatting utilities (if extracted)
  - Period-bucketing utilities (month/quarter)
  - Margin % weighting logic (handles zero revenue)
- **Integration**:
  - Server-side dashboard data function returns correct aggregates for each filter (monthly/quarterly/ytd)
  - Target read/write functions enforce validation + authorization errors are handled cleanly
- **E2E**:
  - Executive Dashboard Viewer can load dashboard and switch filters
  - Target Editor can update annual target and see KPI update
  - Non-Target Editor cannot update target

## Re-check: Constitution (Post-Design)

- Stack/design boundaries preserved: PASS
- Auth/RLS model preserved: PASS (requires implementing the planned `revenue_targets` write policies)
- Schema-first: PASS (any policy changes must be reflected in `schema.sql`)

## Complexity Tracking

No constitution violations required for this feature.
