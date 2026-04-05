# Tasks: Executive Dashboard

**Input**: Design documents from `/specs/005-executive-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Unit + Integration + E2E are REQUIRED by the project constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repo structure for the feature and ensure the new route can be worked on safely.

- [X] T001 Create feature module folders `lib/executive/` and `app/protected/executive/`
- [X] T002 [P] Add baseline types for this feature in `lib/executive/types.ts` (periodFilter union + DTOs from contracts)
- [X] T003 [P] Add formatting helpers in `lib/executive/format.ts` (currency + percent formatting) and reuse existing patterns
- [X] T004 [P] Add period helpers in `lib/executive/period.ts` (month/quarter bucketing utilities used by breakdown queries)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

- [X] T005 Implement Viewer and Target Editor access checks in lib/executive/access.ts (use CurrentProfile, isActive, isExecutiveViewer, and role-based editor checks)
- [X] T006 Implement route gating shell in `app/protected/executive/page.tsx` (server-side redirect like `app/protected/sales/page.tsx`)
- [X] T007 Add data-layer skeleton in `lib/executive/dashboard.ts` (typed functions, no UI concerns)
- [X] T008 [P] Add reusable empty-state UI helper in `components/executive/empty-state.tsx`
- [X] T009 Wire initial page shell UI in `app/protected/executive/page.tsx` (title + description, placeholder sections)
- [X] T045 Add RLS SELECT policy for public.purchase_orders in schema.sql to allow active Executive Dashboard Viewers (profiles.is_executive_viewer = TRUE and is_active = TRUE) to read rows for Executive Dashboard aggregates (read-only; no write permissions).

**Checkpoint**: Foundation ready — proceed with user stories.

---

## Phase 3: User Story 1 - View Executive KPI Snapshot (Priority: P1) 🎯 MVP

**Goal**: Executives can open an Executive Dashboard and view YTD KPIs plus revenue breakdown and PO summary with period filters.

**Independent Test**: With seeded `purchase_orders` and an annual `revenue_targets` row, opening `/protected/executive` shows KPI cards and a revenue breakdown that changes when switching filters; PO totals/margin summary updates accordingly.

### Tests for User Story 1 (Required) ⚠️

- [X] T010 [P] [US1] Unit test period helpers in `tests/unit/executive/period.test.ts`
- [X] T011 [P] [US1] Unit test KPI calculations (weighted margin %, YTD sums) in `tests/unit/executive/metrics.test.ts`
- [X] T012 [P] [US1] Integration test dashboard aggregates for each filter and verify non-Viewers cannot read Executive Dashboard aggregates in tests/integration/executive-dashboard-kpis.test.ts
- [X] T013 [P] [US1] E2E smoke test for Executive Dashboard Viewer load + filter switch and verify non-Viewers are blocked/redirected in tests/e2e/executive-dashboard.spec.ts

### Implementation for User Story 1

- [X] T014 [US1] Implement YTD KPI query functions in `lib/executive/dashboard.ts` (YTD booked revenue, annual target, weighted YTD margin %)
- [X] T015 [US1] Implement revenue breakdown queries in `lib/executive/dashboard.ts` (monthly + quarterly booked revenue for current year); when periodFilter = ytd, return ytdRevenueByMonth as monthly-by-month booked revenue for the current year (same values as monthly; different field name per contract).
- [X] T016 [US1] Implement PO totals + margin summary in `lib/executive/dashboard.ts` for selected period
- [X] T017 [US1] Add period filter UI control in `app/protected/executive/page.tsx` (monthly/quarterly/ytd)
- [X] T018 [US1] Render KPI cards in `app/protected/executive/page.tsx` using existing `components/ui/card.tsx`
- [X] T019 [US1] Render revenue breakdown section in `app/protected/executive/page.tsx` (simple table/list, no new chart libs)
- [X] T020 [US1] Render PO totals + margin summary section in `app/protected/executive/page.tsx`
- [X] T021 [US1] Add empty/loading/error states in `app/protected/executive/page.tsx` and `components/executive/empty-state.tsx`

**Checkpoint**: US1 is demoable as an MVP.

---

## Phase 4: User Story 2 - Edit Yearly Revenue Target (Priority: P2)

**Goal**: Target Editors (active users with role owner or executive) can edit the single overall annual revenue target used by “Revenue YTD vs Target”.

**Independent Test**: As a Target Editor, editing the annual target updates the KPI on refresh; non-Target Editors cannot edit.

### Tests for User Story 2 (Required) ⚠️

- [X] T022 [P] [US2] Unit test target input validation in `tests/unit/executive/targets-validation.test.ts`
- [X] T023 [P] [US2] Integration test target read/write helpers and audit log entry creation in tests/integration/executive-targets.test.ts
- [X] T024 [P] [US2] E2E test Target Editor target update flow in `tests/e2e/executive-dashboard-target.spec.ts`

### Implementation for User Story 2

- [X] T025 [US2] Add RLS policies for public.revenue_targets INSERT/UPDATE in schema.sql (Target Editors only: profiles.role IN ('owner','executive') AND profiles.is_active = TRUE) and attach an audit trigger to revenue_targets so successful changes are recorded in public.audit_logs
- [X] T026 [US2] Add data helper to read annual target in `lib/executive/targets.ts` (overall target: `month IS NULL` and `sector IS NULL`)
- [X] T027 [US2] Add data helper to upsert annual target in `lib/executive/targets.ts` (validates non-negative numeric)
- [X] T028 [US2] Add server action for updating target in `app/protected/executive/actions.ts` (no client-side service-role usage)
- [X] T029 [US2] Add “Edit yearly target” UI (input + save button) in `app/protected/executive/page.tsx`
- [X] T030 [US2] Hide/disable target editing UI for non-Target Editors in `app/protected/executive/page.tsx`
- [X] T031 [US2] Add success/error toasts for target updates via `lib/utils/toast-notification.ts`

**Checkpoint**: Target editing works and is access-controlled.

---

## Phase 5: User Story 3 - Review Sales Performance Overview (Priority: P3)

**Goal**: Executives can view a ranked sales performance overview by PO owner for the selected period.

**Independent Test**: With multiple PO creators, switching filters updates a ranked table showing each owner’s booked revenue and margin.

### Tests for User Story 3 (Required) ⚠️

- [X] T032 [P] [US3] Unit test ranking/tie-breaking helpers in `tests/unit/executive/sales-performance.test.ts`
- [X] T033 [P] [US3] Integration test sales performance aggregation for each filter in `tests/integration/executive-sales-performance.test.ts`
- [X] T034 [P] [US3] E2E test sales performance section updates with filters in `tests/e2e/executive-dashboard-performance.spec.ts`

### Implementation for User Story 3

- [X] T035 [US3] Implement sales performance aggregation in `lib/executive/dashboard.ts` (group by `purchase_orders.created_by`, sums, order desc)
- [X] T036 [US3] Resolve PO owner names via `public.profiles` in `lib/executive/dashboard.ts` (handle missing names)
- [X] T037 [US3] Render sales performance table in `app/protected/executive/page.tsx`
- [X] T038 [US3] Ensure sales performance section responds to the same period filter in `app/protected/executive/page.tsx`
- [X] T039 [US3] Add empty-state behavior for sales performance in `components/executive/empty-state.tsx`

**Checkpoint**: All executive dashboard sections are implemented.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, consistency, and performance.

- [X] T040 [P] Add lightweight skeleton/loading placeholders in `components/ui/skeleton.tsx` usage on `app/protected/executive/page.tsx`
- [X] T041 Accessibility pass for filter and forms in `app/protected/executive/page.tsx` (labels, focus order, ARIA where needed)
- [X] T042 Performance pass: ensure queries are aggregated and return minimal columns in `lib/executive/dashboard.ts`
- [X] T043 Update feature documentation references in `README.md` (add note about `/protected/executive` and access requirements)
- [ ] T044 Validate the full flow using [quickstart.md](./quickstart.md)

---

## Dependencies & Execution Order

### Dependency Graph (User Stories)

```text
Phase 1 (Setup) -> Phase 2 (Foundational) -> US1 (MVP)
									   -> US2
									   -> US3

US2 depends on US1 (adds editing to an existing KPI)
US3 depends on US1 (adds a new section using the same filter)
```

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS user stories
- **User Stories (Phase 3+)**: Depend on Foundational
- **Polish (Phase 6)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; provides MVP value
- **US2 (P2)**: Depends on US1 page existence; adds target editing to KPI
- **US3 (P3)**: Depends on US1 filter + page sections; adds sales performance aggregation and UI

## Parallel Opportunities

- Phase 1 tasks marked [P] can run in parallel
- In US phases, unit/integration/e2e test tasks are marked [P] and can be authored in parallel

## Parallel Example: US1

```text
Parallel set A (UI):
- T017 Add period filter UI control in app/protected/executive/page.tsx
- T018 Render KPI cards in app/protected/executive/page.tsx
- T019 Render revenue breakdown section in app/protected/executive/page.tsx

Parallel set B (Data):
- T014 Implement YTD KPI query functions in lib/executive/dashboard.ts
- T015 Implement revenue breakdown queries in lib/executive/dashboard.ts
- T016 Implement PO totals + margin summary in lib/executive/dashboard.ts
```

## Parallel Example: US2

```text
Parallel set A (DB/Auth):
- T025 Add RLS policies for public.revenue_targets INSERT/UPDATE in schema.sql

Parallel set B (App):
- T026 Add data helper to read annual target in lib/executive/targets.ts
- T029 Add “Edit yearly target” UI in app/protected/executive/page.tsx
```

## Parallel Example: US3

```text
Parallel set A (Aggregation):
- T035 Implement sales performance aggregation in lib/executive/dashboard.ts
- T036 Resolve PO owner names via public.profiles in lib/executive/dashboard.ts

Parallel set B (UI):
- T037 Render sales performance table in app/protected/executive/page.tsx
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 + Phase 2
2. Implement and validate US1 end-to-end
3. Demo/verify via [quickstart.md](./quickstart.md)

### Incremental Delivery

- Add US2 (target editing) once US1 is stable
- Add US3 (sales performance overview) last

## Notes

- Every task follows: `- [ ] T### [P?] [US?] description with file path`
- User story tasks include `[US1]`, `[US2]`, `[US3]` labels
- Avoid adding new UI frameworks (no chart libs for v1)
