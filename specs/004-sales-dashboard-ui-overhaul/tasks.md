# Tasks: Sales Dashboard UI Overhaul

**Input**: Design documents from `/specs/004-sales-dashboard-ui-overhaul/`  
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/api-database.md  
**Feature Branch**: `004-sales-dashboard-ui-overhaul`  
**Date Generated**: April 5, 2026

**Organization**: Tasks grouped by implementation phase and user story priority (P1 → P2). Each user story is independently testable and deployable once its phase completes.

---

## Format: `[ID] [P] [Story] Description`

- **[ID]**: Sequential task identifier (T001, T002, etc.) in execution order
- **[P]**: Task can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3) - omitted for Setup/Foundational/Polish phases
- **File paths**: All implementation artifacts specified with exact paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project structure and initialize directories for feature implementation

- [X] T001 Create directories: `app/protected/sales/clients/`, `app/protected/sales/quotations/`, `app/protected/sales/purchase-orders/` (no content yet)
- [X] T002 [P] Create directories: `components/dialogs/`, `components/tables/`, `components/layouts/` (no content yet)
- [X] T003 [P] Create directory: `lib/sales/` and `lib/utils/` for utilities (no content yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before ANY user story implementation

**⚠️ CRITICAL**: All foundational tasks must complete before moving to user story phases; user stories can then proceed in parallel

### Database Schema & RLS

- [X] T004 Add `clients` table to `schema.sql`: columns for id (UUID), department_id, code (UNIQUE), name, contact_person, email, phone, address, created_by, created_at, updated_at
- [X] T005 Add `quotations` table to `schema.sql`: columns for id, department_id, client_id, amount, status (enum), approval_chain (JSONB), rejection_reason, submitted_at, created_by, created_at, updated_at
- [X] T006 Add `quotation_approvals` table to `schema.sql`: columns for id, quotation_id, approved_by, role, action (approved/rejected), reason, created_at
- [X] T007 Add `purchase_orders` table to `schema.sql`: columns for id, department_id, client_id, po_number (UNIQUE), total_amount, collected_amount, status, created_by, created_at, updated_at
- [X] T008 Add `collections` table to `schema.sql`: columns for id, purchase_order_id, amount, recorded_by, created_at
- [X] T009 Create trigger in `schema.sql` to update PO `collected_amount` when new collection is inserted (SUM of all collections for that PO)
- [X] T010 [P] Add RLS policy to `schema.sql`: Enable RLS on `clients` table; users can SELECT/INSERT clients in their department
- [X] T011 [P] Add RLS policy to `schema.sql`: Enable RLS on `quotations` table; users view quotations in department; executives can view high-value quotations (>= 3M)
- [X] T012 [P] Add RLS policy to `schema.sql`: Enable RLS on `quotation_approvals` table; users view audit trail for quotations they can access
- [X] T013 [P] Add RLS policy to `schema.sql`: Enable RLS on `purchase_orders` table; users can SELECT/INSERT POs in their department
- [X] T014 [P] Add RLS policy to `schema.sql`: Enable RLS on `collections` table; users can record collections on POs in their department

### Responsive Sidebar Layout

- [X] T015 Create `components/layouts/sidebar.tsx`: Responsive sidebar component with desktop persistent sidebar (≥768px) and mobile hamburger menu (<768px) using Tailwind responsive classes and state management
- [X] T016 [P] Create `lib/utils/useMediaQuery.ts`: Custom React hook that detects viewport breakpoints (≥768px for desktop, <768px for mobile) and handles resize events
- [X] T017 Create `app/protected/layout.tsx`: Update or create dashboard layout wrapper combining sidebar + main content area; use `useMediaQuery` hook to toggle sidebar visibility
- [X] T018 [P] Create `components/layouts/dashboard-layout.tsx`: Main content wrapper with flex layout; sidebar on left, scrollable content area on right

### Core Utilities & Helpers

- [X] T019 Create `lib/sales/clients.ts`: Implement fetchClients(departmentId) and validateClientCodeUniqueness(code) functions using Supabase client
- [X] T020 [P] Create `lib/sales/quotations.ts`: Implement fetchQuotations(departmentId) and determineApprovalLevel(amount) functions
- [X] T021 [P] Create `lib/sales/purchase-orders.ts`: Implement fetchPurchaseOrders(departmentId) function using Supabase client
- [X] T022 Create `lib/sales/approval-workflow.ts`: Implement approvalWorkflow state machine to determine next status based on amount and current approver role; export function determineNextQuotationStatus(currentStatus, userRole, quotationAmount)
- [X] T023 [P] Create `lib/utils/client-code-generator.ts`: Implement generateClientCode() function to create C[6 random digits] format (e.g., C734829)
- [X] T024 [P] Create `lib/utils/toast-notification.ts`: Implement useToast() hook wrapper for success/error notifications with auto-dismiss

### Unit Tests for Foundational Utilities

- [X] T025 [P] Create `tests/unit/client-code-generator.test.ts`: Test generateClientCode() returns correct format, tests randomness, tests multiple calls produce different codes
- [X] T026 [P] Create `tests/unit/approval-workflow.test.ts`: Test determineNextQuotationStatus() for amounts < 3M and >= 3M; test all state transitions (Draft → Pending[SalesManager] → Approved/Rejected/Pending[Owner], etc.)
- [X] T027 [P] Create `tests/unit/collection-validation.test.ts`: Test collection validation logic (amount must be positive, total must not exceed PO total)
- [X] T028 [P] Create `tests/unit/useMediaQuery.test.ts`: Test useMediaQuery hook returns correct boolean for viewport widths; test resize event handling

**Checkpoint**: Foundation complete - all schema, RLS policies, utilities, and responsive layout in place. Ready to begin user story implementation in parallel.

---

## Phase 3: User Story 1 - Responsive Dashboard Layout with Sidebar + Client Management (Priority: P1) 🎯 MVP

**Goal**: Sales employees can view a responsive dashboard with persistent sidebar navigation and manage clients via table with dialog-based creation (auto-generated codes) and filtering.

**Independent Test**: A user can load the dashboard on desktop and see a full sidebar with navigation. On mobile, hamburger menu appears and opens/closes without page refresh. User can create a client in a dialog, auto-generate code, and see new client in a searchable/filterable table.

### Tests for User Story 1 (Required - Write FIRST, ensure FAIL before implementation) ⚠️

- [X] T029 [P] [US1] Create `tests/unit/clients.test.ts`: Unit tests for validateClientCodeUniqueness() and client data validation
- [X] T030 [P] [US1] Create `tests/integration/clients-table.test.ts`: Integration test for fetchClients() query; verify RLS filtering by department; test with multiple departments
- [X] T031 [P] [US1] Create `tests/integration/create-client.test.ts`: Integration test for createClientAction() server action; verify new client is created with auto-generated code; verify uniqueness constraint prevents duplicate codes
- [X] T032 [US1] Create `tests/e2e/sales-dashboard-layout.spec.ts`: E2E test for responsive layout; verify sidebar visible on desktop (1024px); verify hamburger visible on mobile (375px); test toggle functionality
- [X] T033 [US1] Create `tests/e2e/clients-create-search.spec.ts`: E2E test for client creation flow; open dialog, auto-generate code, fill form, submit; verify new client appears in table; test filter/search by name, code, contact

### Implementation for User Story 1

- [X] T034 [P] [US1] Create `app/protected/sales/clients/actions.ts`: Implement createClientAction(formData) server action; validate inputs, check code uniqueness, insert to Supabase `clients` table, return success/error response per contracts/api-database.md
- [X] T035 [P] [US1] Create `app/protected/sales/clients/actions.ts`: Implement fetchClientsAction() server action; query Supabase `clients` table for current user's department, apply RLS filtering, return array of clients
- [X] T036 [P] [US1] Create `components/dialogs/create-client-dialog.tsx`: React component with form fields (name required, contact_person, email, phone, address optional); "Generate Code" button calls generateClientCode(); submit button calls createClientAction; include error handling and toast notifications
- [X] T037 [US1] Create `components/dialogs/client-details-dialog.tsx`: Read-only dialog component displaying full client information (code, name, contact, email, phone, address, created_at); receives client object as prop
- [X] T038 [P] [US1] Create `components/tables/clients-table.tsx`: Shadcn/ui table component with columns (Code, Name, Contact, Email, Phone); include row click handler to open client-details-dialog; implement filtering/search by name/code/contact using React hooks; display empty state when no results
- [X] T039 [US1] Create `app/protected/sales/clients/page.tsx`: Page component rendering clients table; fetch clients on mount using fetchClientsAction(); include "Create Client" button that opens create-client-dialog; handle table refresh after dialog submission using router.refresh()
- [X] T040 [P] [US1] Create form validation in `lib/utils/form-validation.ts`: Validate client name (non-empty), email (valid format), phone (10-20 chars), address (non-empty if required per spec); reuse in T034 and T036

### Integration: User Story 1

- [X] T041 [US1] Update `app/protected/sales/layout.tsx`: Add a sales layout that routes to different tabs (Clients, Quotations, Purchase Orders); include active tab highlighting; use Next.js Link for navigation

**Checkpoint**: User Story 1 complete. Sidebar responsive, clients can be created with auto-generated unique codes, table displays with filtering, and dialog interactions work. Ready for US2 and US3 parallel implementation.

---

## Phase 4: User Story 2 - Quotation Management with Amount-Based Approval Workflow (Priority: P2)

**Goal**: Sales staff can create quotations (handled in future task); sales managers and executives can view quotations in a table, submit for approval, and approve/reject via amount-based multi-level workflow (< 3M: sales_manager only; >= 3M: sales_manager → owner → executive).

**Independent Test**: A sales manager can view quotations in a table, click a quotation to see full details including approval chain, approve a quotation under 3M (status → Approved), and approve a high-value quotation that routes to owner/executive approval. Rejection terminates the approval chain.

### Tests for User Story 2 (Required - Write FIRST, ensure FAIL before implementation) ⚠️

- [X] T042 [P] [US2] Create `tests/unit/quotation-approval-workflow.test.ts`: Unit tests for approval state machine; test determineNextQuotationStatus() for all scenarios (< 3M, >= 3M, each approver role); test rejection at any stage
- [X] T043 [P] [US2] Create `tests/integration/quotations.test.ts`: Integration test for fetchQuotations() query; verify RLS filtering for sales_staff vs sales_manager roles; test high-value quotation visibility for executives
- [X] T044 [P] [US2] Create `tests/integration/quotation-approval.test.ts`: Integration tests for submitQuotationForApprovalAction(), approveQuotationAction(), and rejectQuotationAction(); verify status transitions, approval_chain JSONB updates, audit trail entries in quotation_approvals table
- [X] T045 [US2] Create `tests/e2e/quotations-approval-workflow.spec.ts`: E2E test for full quotation approval journey; create test quotations (< 3M and >= 3M); submit for approval; approve at each level; verify status changes in UI; test rejection flow

### Implementation for User Story 2

- [X] T046 [P] [US2] Create `app/protected/sales/quotations/actions.ts`: Implement submitQuotationForApprovalAction(quotationId) server action; verify quotation is Draft, user is creator; update status to Pending[SalesManager], set submitted_at timestamp; return updated quotation or error per contracts/api-database.md
- [X] T047 [P] [US2] Create `app/protected/sales/quotations/actions.ts`: Implement approveQuotationAction(quotationId, userRole) server action; determine next status using determineNextQuotationStatus(); update quotation.status and approval_chain JSON; insert audit record in quotation_approvals table; return updated quotation or error
- [X] T048 [P] [US2] Create `app/protected/sales/quotations/actions.ts`: Implement rejectQuotationAction(quotationId, reason) server action; set status to Rejected, set rejection_reason, insert audit record; terminate approval chain (no further approvals); return updated quotation or error
- [X] T049 [US2] Create `app/protected/sales/quotations/actions.ts`: Implement fetchQuotationsAction(departmentId, userRole) server action; query Supabase quotations table; apply RLS filtering (department for staff/managers, high-value for executives); return array sorted by submitted_at or created_at
- [X] T050 [P] [US2] Create `components/dialogs/quotation-details-dialog.tsx`: Read-only dialog component displaying quotation details (ID, client name, amount, status, items if available, approval chain state, rejection reason if rejected); conditional buttons based on user role and quotation status: "Submit for Approval" (if Draft), "Approve"/"Reject" (if user is required approver and quotation is Pending for their role); call appropriate actions on button click; include toast notifications
- [X] T051 [P] [US2] Create `components/tables/quotations-table.tsx`: Shadcn/ui table component with columns (ID, Client Name, Amount, Status, Date); row click opens quotation-details-dialog; include status badge styling (different colors for Draft, Pending, Approved, Rejected); sortable by amount/date
- [X] T052 [US2] Create `app/protected/sales/quotations/page.tsx`: Page component rendering quotations table; fetch quotations on mount using fetchQuotationsAction(); handle table refresh after approval/rejection/submission actions using router.refresh(); display approval chain status helpers (e.g., "Awaiting Sales Manager approval")

**Checkpoint**: User Story 2 complete. Quotation approval workflow functional for both < 3M and >= 3M paths. All approvers can see their pending quotations and take action. Audit trail populated.

---

## Phase 5: User Story 3 - Purchase Order Management with Collection Tracking (Priority: P2)

**Goal**: Sales employees can create purchase orders, view them in a table, see details in a dialog, and record collections that correctly accumulate and update the collected amount.

**Independent Test**: A user can create a purchase order with all required details, see it in a table, click to view full details in a dialog, record a collection (e.g., $500 on $1000 PO), and see collected amount update to $500. Recording a second $200 collection updates total to $700 (accumulated, not replaced).

### Tests for User Story 3 (Required - Write FIRST, ensure FAIL before implementation) ⚠️

- [X] T053 [P] [US3] Create `tests/integration/purchase-orders.test.ts`: Integration test for fetchPurchaseOrders() query; verify RLS filtering by department; test with multiple departments
- [X] T054 [P] [US3] Create `tests/integration/purchase-order-create.test.ts`: Integration test for createPurchaseOrderAction() server action; verify PO is created with unique po_number; collected_amount initializes to 0
- [X] T055 [P] [US3] Create `tests/integration/collection-recording.test.ts`: Integration test for recordCollectionAction(); verify collection inserts successfully; verify purchase_orders.collected_amount updates via trigger; test validation that collection + existing total ≤ PO total; test rejection when exceeds balance
- [X] T056 [US3] Create `tests/e2e/purchase-orders-collection.spec.ts`: E2E test for full PO journey; create PO; view in table; open details dialog; record collection; verify collected amount updates in real-time; record second collection; verify accumulation

### Implementation for User Story 3

- [X] T057 [P] [US3] Create app/protected/sales/purchase-orders/actions.ts: Implement createPurchaseOrderAction(formData) server action; validate inputs (total_amount > 0); generate unique po_number with format PO-{DEPT_CODE}-{YEAR}-{SEQUENCE} (e.g., PO-SALES-2026-0001) via database sequence or counter function; insert to Supabase purchase_orders table with collected_amount = 0; return new PO with generated po_number or error
- [X] T058 [P] [US3] Create `app/protected/sales/purchase-orders/actions.ts`: Implement recordCollectionAction(poId, amount) server action; validate amount > 0 and (collected_amount + amount ≤ total_amount); insert to collections table; trigger updates PO.collected_amount; return updated PO or validation error per contracts/api-database.md
- [X] T059 [P] [US3] Create `app/protected/sales/purchase-orders/actions.ts`: Implement fetchPurchaseOrdersAction(departmentId) server action; query Supabase purchase_orders table with RLS filtering; return array including client name join, collection history if available
- [X] T060 [P] [US3] Create `components/dialogs/create-po-dialog.tsx`: Form component with fields for client_id (required, dropdown), po_number (optional, auto-generated or user-provided), total_amount (required, positive number), status (dropdown: Draft/Active); submit calls createPurchaseOrderAction(); include validation and toast notifications
- [X] T061 [P] [US3] Create `components/dialogs/record-collection-dialog.tsx`: Form component for recording collection; displays current PO total and collected amount; input field for collection amount with real-time validation (amount > 0, total ≤ remaining balance); submit calls recordCollectionAction(); show error toast if exceeds balance; success toast and close on success
- [X] T062 [US3] Create `components/dialogs/purchase-order-details-dialog.tsx`: Read-only dialog component displaying PO details (PO number, client name, total_amount, collected_amount, status); includes "Record Collection" button that opens record-collection-dialog; displays collection history if available (list of previous collections with amounts and dates); receives PO object as prop
- [X] T063 [P] [US3] Create `components/tables/purchase-orders-table.tsx`: Shadcn/ui table component with columns (PO #, Client Name, Total Amount, Collected Amount, Status, Date); row click opens purchase-order-details-dialog; sortable by amount/date; include collected amount progress visualizer (e.g., "500 / 1000" or progress bar)
- [X] T064 [US3] Create `app/protected/sales/purchase-orders/page.tsx`: Page component rendering POs table; fetch POs on mount using fetchPurchaseOrdersAction(); include "Create Purchase Order" button opening create-po-dialog; handle dialog refresh after creation or collection recording using router.refresh()

**Checkpoint**: User Story 3 complete. Purchase orders can be created, viewed in table and detail dialogs, and collections recorded with accurate accumulation. Balance validation prevents overpayment.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete the feature with refinements, validation improvements, responsive testing, and documentation

### Form Validation & Error Handling

- [X] T065 [P] Add client email validation using regex in `lib/utils/form-validation.ts`; test valid/invalid email formats
- [X] T066 [P] Add phone number validation (10-20 chars, digits + optional spaces/dashes) in `lib/utils/form-validation.ts`
- [X] T067 [P] Add PO total_amount validation (must be positive number, max 15 digits before decimal, 2 after) in `lib/utils/form-validation.ts`
- [X] T068 Add comprehensive error messages for all form validations; display inline field errors and summary errors in dialogs

### UI Polish & Empty States

- [X] T069 [P] Add empty state messages to all tables: "No clients found" (clients table), "No quotations" (quotations table), "No purchase orders" (POs table); style with icon and explanatory text
- [X] T070 [P] Add loading state skeletons to all tables while data is fetching (use Shadcn/ui Skeleton component)
- [X] T071 [P] Add toast notification styling and behavior: success (green, auto-dismiss 3s), error (red, auto-dismiss 5s), include icon + message
- [X] T072 Add "No results match your search" message to filtered tables with clear filter/clear button

### Responsive Design Testing

- [X] T073 Test sidebar behavior on breakpoints: 320px (mobile), 640px (mobile), 768px (responsive breakpoint for sidebar toggle - Tailwind md:), 1024px+ (optimal desktop display width); verify sidebar toggle behavior at 768px threshold specifically
- [X] T074 [P] Test table responsiveness on mobile: verify columns stack or scroll horizontally; verify dialog opens full-screen or centered on small viewports
- [X] T075 [P] Test form input fields on mobile: verify touch-friendly sizing, proper keyboard focus, no horizontal scroll
- [X] T076 Test all dialogs on viewport sizes 320px, 768px, 1024px; verify scrolling within dialog when content exceeds viewport

### Accessibility Audit

- [X] T077 [P] Verify all dialogs have proper ARIA labels (aria-label, aria-labelledby for headers)
- [X] T078 [P] Verify all buttons have accessible text (no icon-only buttons without aria-label)
- [X] T079 [P] Verify form labels are properly associated with inputs (htmlFor attribute)
- [X] T080 [P] Verify keyboard navigation works: Tab through all controls, Enter/Space activate buttons, Esc closes dialogs
- [X] T081 Verify color contrast meets WCAG AA standards (4.5:1 for text, 3:1 for UI components)

### Documentation & Quickstart Validation

- [X] T082 Verify `quickstart.md` examples are accurate; test code examples compile and run (generateClientCode, approvalWorkflow, recordCollection)
- [X] T083 Update `quickstart.md` with setup instructions for running E2E tests for feature 004
- [X] T084 Add troubleshooting section to `quickstart.md` for common issues (RLS permission errors, code generation conflicts, collection validation)
- [X] T085 Generate `checklists/implementation-checklist.md` with task completion tracking for developers

### End-to-End Flow Validation

- [X] T086 Create comprehensive E2E test `tests/e2e/sales-dashboard-full-flow.spec.ts`: Create client → Create quotation → Submit for approval → Approve → Create PO → Record collection; verify all data persists and updates in real-time
- [ ] T087 Manual test: Full user journey on desktop and mobile (login → navigate dashboard → create client → create quotation → approve → create PO → record collection)
- [X] T088 Performance test: Table rendering with 500+ rows; measure time to interactive (TTI) and report any slowdowns

### Final Code Quality

- [X] T089 [P] Run TypeScript type check: `tsc --noEmit` across all new feature files; fix any type errors
- [X] T090 [P] RunESLint linting: `npm run lint` on all new files in app/, components/, lib/; fix style violations
- [X] T091 [P] Run tests: `npm run test:unit`, `npm run test:integration`, `npx playwright test`; ensure all pass
- [X] T092 Code review: All feature code reviewed for consistency with project patterns, no dead code, proper error handling
- [X] T093 [P] Update `README.md` feature section: Document 004-sales-dashboard-ui-overhaul feature, user stories, how to run/test

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Status |
|-------|-----------|--------|
| **Phase 1: Setup** | None | Ready to start immediately |
| **Phase 2: Foundational** | Phase 1 complete | Blocks all user stories |
| **Phase 3: US1 (P1)** | Phase 2 complete | Ready after foundational; MVP scope |
| **Phase 4: US2 (P2)** | Phase 2 complete | Ready after foundational; can run parallel with US1 once Phase 2 done |
| **Phase 5: US3 (P2)** | Phase 2 complete | Ready after foundational; can run parallel with US1 and US2 |
| **Phase 6: Polish** | All user stories (P1-P2) complete | Can start incrementally as stories complete |

### Within-Phase Parallelization

**Phase 2 Foundational**:
- T004-T014 (schema + RLS): Sequential (each table depends on previous schema state)
- T015-T018 (sidebar layout): Parallel [P] marked tasks
- T019-T024 (utilities): Parallel [P] marked tasks
- T025-T028 (unit tests): Parallel [P] marked tasks

**Phase 3 User Story 1**:
- T029-T031 (tests), T034-T035 (actions), T036-T037 (dialogs), T038, T040 (forms): [P] tasks run in parallel
- T039 (page component): Depends on T034, T035, T036, T038 complete
- T041 (integration): Depends on T039 complete

**Phase 4 User Story 2**:
- T042-T044 (tests): Parallel [P] tasks
- T046-T049 (actions): Parallel [P] tasks
- T050-T051 (components): Parallel [P] tasks
- T052 (page): Depends on T046-T051 complete

**Phase 5 User Story 3**:
- T053-T055 (tests): Parallel [P] tasks
- T057-T059 (actions): Parallel [P] tasks
- T060-T063 (components): Parallel [P] tasks
- T064 (page): Depends on T057-T063 complete

**Phase 6 Polish**:
- All [P] marked validation, testing, accessibility, and documentation tasks can run in parallel

---

## Parallel Execution Examples

### For a Single Developer (Sequential Delivery)

```
Week 1:  Phase 1 + Phase 2 (Setup + Foundational)
Week 2:  Phase 3 (User Story 1 - MVP)   → Validate independently
Week 3:  Phase 4 (User Story 2)         → Add to MVP
Week 4:  Phase 5 (User Story 3)         → Complete feature
Week 5:  Phase 6 (Polish)               → Final QA + release
```

### For a 3-Person Team (Parallel Delivery)

```
Days 1-3:    All together: Phase 1 + Phase 2 (foundational)
Days 4+:     Phase 2 checkpoint reached
  - Developer A: Phase 3 (User Story 1)
  - Developer B: Phase 4 (User Story 2)
  - Developer C: Phase 5 (User Story 3) + Phase 6 (Polish)
Days 8-10:   All stories complete, final integration + release
```

### Parallel Test & Implementation in Phase 3

```bash
# Start these 3 tests in parallel (they fail initially - TDD):
Task T029: tests/unit/clients.test.ts
Task T030: tests/integration/clients-table.test.ts
Task T031: tests/integration/create-client.test.ts

# While tests develop, start UI components in parallel:
Task T034: app/protected/sales/clients/actions.ts
Task T036: components/dialogs/create-client-dialog.tsx
Task T038: components/tables/clients-table.tsx

# Once actions + components ready, implement integration:
Task T041: Update sales layout and routing

# Run tests - should PASS now
```

---

## Implementation Strategy

### MVP (Minimum Viable Product)

The MVP scope is **User Story 1 only** (Responsive Dashboard + Client Management):

1. ✅ Complete Phase 1: Setup
2. ✅ Complete Phase 2: Foundational
3. ✅ Complete Phase 3: User Story 1 (P1)
4. 🎯 **STOP AND VALIDATE**: All US1 tests pass, responsive layout works, client creation/filtering functional
5. ✅ Deploy/demo Phase 1-3 to stakeholders

**MVP deliverables**: Responsive sidebar, client table, create/search functionality. Does NOT include quotation approval or PO tracking yet.

### Incremental Feature Delivery

After MVP validation, continue sequentially or in parallel:

1. MVP complete (Phase 1-3)
2. ➕ Add User Story 2 (Phase 4): Quotation approval workflow
   - Deploy/demo Phase 4 to stakeholders
3. ➕ Add User Story 3 (Phase 5): Purchase order collection tracking
   - Deploy/demo Phase 5 to stakeholders
4. ✨ Polish & optimize (Phase 6)
   - Final QA, accessibility audit, performance optimization

### Scaling with Team

- **1 developer**: Follow Sequential Delivery example (5 weeks)
- **2 developers**: One on US1+US2 (sequential), one on US3 + Phase 6
- **3+ developers**: True parallelization - all stories simultaneous after foundational completes

---

## Success Criteria (Per spec.md)

- [ ] **SC-001**: Sales employees can create a client in under 1 minute (Form + auto-code + submit)
- [ ] **SC-002**: Sales employees can find a specific client in under 30 seconds (Table filters/search)
- [ ] **SC-003**: Sales managers can approve/reject a quotation in under 2 minutes (Review details + approve/reject)
- [ ] **SC-004**: Dashboard fully responsive (320px mobile to 1024px+ desktop; all interactions work without page reload)
- [ ] **SC-005**: 100% of quotation approval actions succeed without permission errors (RLS policies correctly enforce role-based access)
- [ ] **SC-006**: Collection recording updates PO collected amount within 2 seconds (no stale data; trigger fires correctly)
- [ ] **SC-007**: All forms include validation with user-friendly error messages (no vague errors)
- [ ] **SC-008**: Zero data loss or duplication in auto-generated client codes (UNIQUE constraint + retry logic)

---

## Task Summary

| Phase | Count | Tasks |
|-------|-------|-------|
| **Phase 1: Setup** | 3 | T001-T003 |
| **Phase 2: Foundational** | 25 | T004-T028 |
| **Phase 3: US1 (P1)** | 13 | T029-T041 |
| **Phase 4: US2 (P2)** | 7 | T042-T052 |
| **Phase 5: US3 (P2)** | 8 | T053-T064 |
| **Phase 6: Polish** | 29 | T065-T093 |
| **TOTAL** | **85 tasks** | T001-T093 |

---

## Checklist Format Validation

All tasks follow the mandatory checklist format:

✅ Checkbox: `- [ ]`  
✅ Task ID: `T001`, `T002`, etc. (sequential)  
✅ [P] marker: Included for parallelizable tasks  
✅ [Story] label: Included for user story tasks (US1, US2, US3)  
✅ Description: Clear action with file path  

**Example valid tasks**:
- `- [ ] T001 Create project structure per implementation plan`
- `- [ ] T015 Create components/layouts/sidebar.tsx: Responsive sidebar component...`
- `- [ ] T029 [P] [US1] Create tests/unit/clients.test.ts: Unit tests...`
- `- [ ] T065 [P] Add client email validation in lib/utils/form-validation.ts...`

---

## Notes for Developers

1. **Tests First (TDD)**: For each user story phase, write tests (T029-T031 for US1, etc.) FIRST. They should FAIL initially. Then implement features (T034+) to make tests PASS.

2. **Independence**: Each user story (US1, US2, US3) is independently testable and deployable. Complete one story's phase fully before moving to the next to maintain this independence.

3. **Parallel Execution**: [P]-marked tasks have no dependencies and can run simultaneously by different developers. This is most effective after foundational phase completes.

4. **Database First**: Phase 2 schema tasks (T004-T014) must all complete before any feature implementation; they are blocking prerequisites.

5. **Checkpoint Validation**: After each user story phase completes, validate independently before moving to the next user story or polish phase.

6. **File Paths**: All implementation artifacts have exact file paths specified in each task. Follow these paths precisely to maintain consistent project structure.

7. **Responsive Design**: Sidebar and all components must be tested on breakpoints 320px (mobile), 768px (tablet), 1024px+ (desktop). Use Playwright's `setViewportSize()` for E2E testing different sizes.

8. **RLS & Auth**: All database queries must respect Row-Level Security policies. Test with different user roles (sales_staff, sales_manager, owner, executive) to ensure proper filtering and access control.

9. **Form Validation**: Use `lib/utils/form-validation.ts` for all input validation. Reuse validation functions across components to avoid duplication.

10. **Error Handling**: All server actions should return `{success: boolean, data?: T, error?: string}` response objects per the contracts in `api-database.md`. Display errors in toast notifications.
