---

description: "Implementation task breakdown for 003-sales-dashboard"
---

# Tasks: Sales Module Dashboard

**Input**: Design documents from `specs/003-sales-dashboard/`
**Prerequisites**: `specs/003-sales-dashboard/plan.md` (required), `specs/003-sales-dashboard/spec.md` (required), plus `specs/003-sales-dashboard/research.md`, `specs/003-sales-dashboard/data-model.md`, `specs/003-sales-dashboard/contracts/routes.md`, `specs/003-sales-dashboard/quickstart.md`

**Tests**: REQUIRED (unit + integration + E2E) per the project constitution and this feature spec.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format

- [ ] `T###` = sequential task ID in execution order
- [ ] `[P]` = parallelizable (different files, no unmet dependencies)
- [ ] `[US#]` = user story label (only inside that story’s phase)
- [ ] Every task includes an exact file path in the description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the planned module skeleton so later story work is isolated to known files.

- [X] T001 Create Sales route skeleton in app/protected/sales/(layout.tsx|page.tsx|clients/page.tsx|quotations/page.tsx|purchase-orders/page.tsx|actions.ts)
- [X] T002 Create Sales lib skeleton in lib/sales/(access.ts|clients.ts|quotations.ts|purchase-orders.ts|summaries.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema-first correctness + auth/authorization primitives required by all stories.

**⚠️ CRITICAL**: No Sales UI work should be considered “done” until RLS and access gating are correct.

- [X] T003 Update CurrentProfile to include role/isExecutiveViewer in lib/profile/ensure-current-profile.ts
- [X] T004 [P] Adjust profile consumers for new CurrentProfile shape in lib/profile/get-current-profile.ts
- [X] T005 [P] Add Sales/approver access helpers (sales-only vs quotations-approver) in lib/sales/access.ts
- [X] T006 Verify/ensure RLS is enabled for ALL Sales tables in schema.sql (public.clients, public.client_contacts, public.quotations, public.quotation_approvals, public.purchase_orders, public.po_payments)
- [X] T007 Tighten Sales RLS policies in schema.sql to prevent Sales users from changing approval decisions (only approver_id can approve/reject); keep Sales ability to assign/correct pending approvals
- [X] T008 Add quotation status sync trigger/function in schema.sql so quotations.status updates when quotation_approvals change (supports owner/executive approvals without granting UPDATE on quotations)
- [X] T009 Add enum support for quotation Draft status in schema.sql AND apply DB change in Supabase (ALTER TYPE approval_status_enum ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending')
- [X] T010 Add recognized_amount maintenance trigger/function for PO payments in schema.sql (recompute SUM(po_payments.amount_collected) per purchase_orders.id)
- [X] T011 Add server-side validation helper(s) for money/percent/int fields in lib/sales/(quotations.ts|purchase-orders.ts|clients.ts)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Sales dashboard navigation + summaries (Priority: P1) 🎯 MVP

**Goal**: Sales users can open `/protected/sales`, navigate tabs via sidebar, and see top-level summaries.

**Independent Test**: With a Sales user session, visit `/protected/sales` and verify (1) sidebar tabs exist, (2) summary renders without errors, (3) non-sales users are redirected away.

### Tests (US1)

- [X] T012 [P] [US1] Unit test Sales access gating helpers in tests/unit/sales-access.test.ts
- [X] T013 [P] [US1] Integration test redirect behavior for Sales deep links in tests/integration/sales-redirect.test.ts
- [X] T014 [P] [US1] E2E test Sales dashboard navigation shell in tests/e2e/sales-dashboard.spec.ts

### Implementation (US1)

- [X] T015 [P] [US1] Implement Sales sidebar layout and top-level access enforcement in app/protected/sales/layout.tsx
- [X] T016 [US1] Implement Sales dashboard summary page (counts/totals) in app/protected/sales/page.tsx
- [X] T017 [P] [US1] Implement summary queries (clients count, quotations by status, PO totals) in lib/sales/summaries.ts
- [X] T018 [US1] Wire dashboard page to summary queries with server-side data fetching in app/protected/sales/page.tsx

**Checkpoint**: `/protected/sales` loads for Sales users, redirects others, and shows summary + sidebar links.

---

## Phase 4: User Story 2 — Manage client records (Priority: P2)

**Goal**: Sales users can create/edit/inactivate clients and manage client contacts.

**Independent Test**: As a Sales user, create a client with required fields (including schema-required client_code), edit it, add a primary contact, and inactivate it; client remains readable in lists.

### Tests (US2)

- [X] T019 [P] [US2] Unit test client input validation and payment-terms mapping in tests/unit/sales-clients-validation.test.ts
- [X] T020 [P] [US2] Integration test client server actions with mocked Supabase client in tests/integration/sales-clients-actions.test.ts
- [X] T021 [P] [US2] E2E test Client Details page loads and basic form elements exist in tests/e2e/sales-clients.spec.ts

### Implementation (US2)

- [X] T022 [P] [US2] Implement client read/write helpers in lib/sales/clients.ts (list, create, update, inactivate)
- [X] T023 [P] [US2] Implement client contact helpers in lib/sales/clients.ts (list contacts, add contact, set primary)
- [X] T024 [US2] Add client CRUD server actions in app/protected/sales/actions.ts (createClientAction, updateClientAction, inactivateClientAction)
- [X] T025 [US2] Add client contact server actions in app/protected/sales/actions.ts (addClientContactAction, setPrimaryContactAction)
- [X] T026 [US2] Implement Client Details UI (list + create/edit + inactivate) in app/protected/sales/clients/page.tsx
- [X] T027 [US2] Implement Client Contacts UI (add contact + primary toggle) in app/protected/sales/clients/page.tsx

**Checkpoint**: Sales users can manage clients + contacts; inactive clients are not selectable for new activity.

---

## Phase 5: User Story 3 — Submit quotations for approval with role-based routing (Priority: P3)

**Goal**: Sales users can submit quotations; approvals route by ₱3,000,000 threshold; approvers can approve/reject.

**Independent Test**: Submit one quotation below threshold and one at/above threshold; verify required approvals created and overall status changes correctly when approvals are applied.

### Tests (US3)

- [X] T028 [P] [US3] Unit test approval routing (<3M vs ≥3M) and status aggregation in tests/unit/sales-quotations-approvals.test.ts
- [X] T029 [P] [US3] Integration test quotation submission server action creates required approvals in tests/integration/sales-quotations-actions.test.ts
- [X] T030 [P] [US3] E2E test quotations page access rules (Sales full access; owner/executive approvals access) in tests/e2e/sales-quotations-access.spec.ts

### Implementation (US3)

- [X] T031 [P] [US3] Implement quotation helpers (list, create draft, submit) in lib/sales/quotations.ts
- [X] T032 [P] [US3] Implement approval helpers (list pending approvals for current user, approve/reject) in lib/sales/quotations.ts
- [X] T033 [US3] Add quotation/approval server actions in app/protected/sales/actions.ts (createQuotationDraftAction, submitQuotationAction, approveQuotationAction, rejectQuotationAction)
- [X] T034 [US3] Implement Quotation Approval UI (create + list + approval queue) in app/protected/sales/quotations/page.tsx
- [X] T035 [US3] Enforce quotations-page access rules (sales OR assigned approver) in app/protected/sales/quotations/page.tsx

**Checkpoint**: Threshold routing works; approvals update status; owner/executive can act on assigned approvals.

---

## Phase 6: User Story 4 — Log purchase orders and track recognized vs closed sales (Priority: P4)

**Goal**: Sales users can log POs, record collections, and see recognized totals update (capped at PO total).

**Independent Test**: Create a PO for a client, record at least one payment, and verify recognized totals update and never exceed PO amount.

### Tests (US4)

- [X] T036 [P] [US4] Unit test PO payment validation (prevent over-collection) in tests/unit/sales-po-payments.test.ts
- [X] T037 [P] [US4] Integration test PO server actions with mocked Supabase client in tests/integration/sales-purchase-orders-actions.test.ts
- [X] T038 [P] [US4] E2E test purchase orders page loads and collections UI exists in tests/e2e/sales-purchase-orders.spec.ts

### Implementation (US4)

- [X] T039 [P] [US4] Implement purchase order helpers (list/create) in lib/sales/purchase-orders.ts
- [X] T040 [P] [US4] Implement PO payment helpers (list/add payment) in lib/sales/purchase-orders.ts
- [X] T041 [US4] Add PO server actions in app/protected/sales/actions.ts (createPurchaseOrderAction, addPoPaymentAction)
- [X] T042 [US4] Implement Purchase Orders UI (list + create PO + record collections) in app/protected/sales/purchase-orders/page.tsx
- [X] T043 [US4] Display Closed vs Recognized totals using schema definitions in app/protected/sales/purchase-orders/page.tsx

**Checkpoint**: PO + payments flow works and recognized totals stay consistent with DB trigger.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final tightening across all stories (docs, guardrails, quickstart verification).

- [X] T044 [P] Add Sales E2E env var documentation to specs/003-sales-dashboard/quickstart.md
- [X] T045 Tighten error handling/messages for Sales server actions in app/protected/sales/actions.ts
- [X] T046 [P] Ensure all Sales pages use consistent UI primitives and spacing in app/protected/sales/(page.tsx|clients/page.tsx|quotations/page.tsx|purchase-orders/page.tsx)
- [X] T047 Run and fix Sales-related tests locally (unit/integration/e2e) via package.json scripts in package.json

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 (Setup) → blocks Phase 2
- Phase 2 (Foundational) → blocks all user stories
- Phase 3 (US1) → can start after Phase 2 (MVP)
- Phase 4–6 (US2–US4) → can start after Phase 2; best delivered in priority order
- Phase 7 (Polish) → after at least US1, ideally after all desired stories

### User story dependency graph

- US1 (P1) depends on Foundational (RLS + access helpers)
- US2 (P2) depends on Foundational
- US3 (P3) depends on Foundational + CurrentProfile role availability
- US4 (P4) depends on Foundational + recognized_amount trigger

---

## Parallel Execution Examples

### Foundational (Phase 2)

- In parallel:
  - `T003` (profile shape) + `T005` (access helpers)
  - `T006–T010` (schema.sql RLS + trigger work) can proceed while UI skeleton exists

### US1

- In parallel:
  - `T012` (unit tests) + `T017` (summary queries)
  - `T014` (E2E shell) can be written once routes exist

### US2

- In parallel:
  - `T019` (unit validation tests) + `T022` (client helpers) + `T026` (page shell)

### US3

- In parallel:
  - `T028` (approval routing unit tests) + `T031` (quotation helpers) + `T034` (page shell)

### US4

- In parallel:
  - `T036` (payment validation tests) + `T039` (PO helpers) + `T042` (page shell)

---

## Implementation Strategy

### MVP (recommended)

1. Complete Phase 1 + Phase 2
2. Complete US1 (Phase 3)
3. Validate: unit + integration + E2E for US1
4. Demo `/protected/sales` navigation + summaries

### Incremental delivery

- Add US2 → demo client CRUD
- Add US3 → demo approval routing + approver access
- Add US4 → demo recognized vs closed totals
