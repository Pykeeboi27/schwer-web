# Implementation Plan: Sales Dashboard UI Overhaul

**Branch**: `004-sales-dashboard-ui-overhaul` | **Date**: April 5, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-sales-dashboard-ui-overhaul/spec.md`

## Summary

The sales dashboard requires a comprehensive UI/UX redesign to improve usability and fix critical approval workflow bugs. Key deliverables are: (1) responsive sidebar navigation (desktop + mobile hamburger), (2) clients table with dialog-based creation and auto-generated codes (C[6 random numbers]), (3) quotations table with multi-level approval workflow (< 3M: sales_manager only; >= 3M: sales_manager → owner → executive), and (4) purchase orders table with collection tracking that correctly accumulates values. All components will use Shadcn/ui dialog and table primitives with Tailwind styling, enforce permissions via Supabase RLS, and include comprehensive E2E test coverage with Playwright.

## Technical Context

**Language/Version**: TypeScript (Next.js App Router / React)
**Primary Dependencies**: 
- Next.js 14+ (App Router - SSR for protected routes)
- React 18+
- TypeScript 5+
- Tailwind CSS 3.3+
- Shadcn/ui (Button, Dialog, Table, Input, Label, Card, Badge components)
- Lucide Icons (for hamburger menu, table icons)
- Supabase JS client (for Auth + DB access)
- Playwright (E2E testing)
- Vitest (unit testing)

**Storage**: Supabase Postgres with RLS policies (schema defined in `schema.sql`)
**Authentication**: Supabase Auth (department-based session management; sales_staff, sales_manager, owner, executive roles)
**Testing**: Unit + Integration + E2E (all required by constitution)
**Target Platform**: Web (mobile: 320px-767px, tablet/desktop: ≥768px). Full dashboard layout optimized at 1024px+.
**Project Type**: Web application (dashboard feature within larger SaaS)

### Technical Decisions

**Layout Architecture**:
- Sidebar: Persistent on desktop (≥768px, Tailwind `md:` breakpoint), hamburger menu on mobile (<768px) using responsive Tailwind classes. Note: 1024px is the optimal display width for full dashboard content; 768px is the responsive breakpoint for sidebar layout switching.
- Responsive state managed via a custom `useMediaQuery` hook or Radix Dialog slot states
- Content area: Flex layout with sidebar + main content; main content scrolls independently
- Mobile: Fixed header bar with hamburger toggle, sidebar overlays with blur backdrop

**Data Management**:
- Server components for data fetching (Supabase queries); client components for interactivity
- Client-side form state via React hooks (`useState`); async submission via server actions
- Real-time table updates: Trigger table refresh after form submissions (create, approve, reject, record collection)
- Polling: Conservative approach; no WebSocket for this release (as per user clarification)

**Client Code Generation**:
- Format: C[6 random digits] (e.g., C734829)
- Generation: Client-side on "Generate Code" button click
- Uniqueness check: Query existing codes before submission; if conflict detected, regenerate or alert user
- Storage: Persisted to Supabase on form submission; database constraint ensures uniqueness

**Approval Workflow State Machine**:
```
Draft (pending)
├─ [Submit for Approval]
└─ Pending[Sales Manager] (amount-based routing)
   ├─ if amount < 3M: [Approve/Reject] → Approved/Rejected
   ├─ if amount >= 3M & sales_manager approves: Pending[Owner+Executive]
   │  ├─ [Approve for owner/exec] → next approver
   │  └─ [Reject] → Rejected (terminates chain)
   └─ [Reject] → Rejected (terminates chain)
```

**Collection Validation**:
- On record collection: validate that `collected_amount + new_collection <= total_amount`
- If validation fails: show toast error "Collection amount exceeds available balance"
- Accumulation: Update `collected_amount = collected_amount + new_collection` via Supabase update
- Concurrency: Supabase transactions handle simultaneous writes; use versioning/optimistic locking if needed

**Notification Pattern**:
- Toast notifications (Shadcn/ui or custom `useToast`) for success/error feedback
- No email notifications (user clarification)
- Transient messages: auto-dismiss after 3-5 seconds

## Constitution Check

**GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.**

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Schema-First Database** | ✅ PASS | New tables (quotation states, collections, approval chain) will be documented in `schema.sql`; RLS policies included. |
| **II. Supabase Auth + RLS** | ✅ PASS | Auth via Supabase; all sensitive data (quotations, approvals, collections) protected by RLS policies based on department and role. |
| **III. Design Tokens + UI** | ✅ PASS | Tailwind CSS + Shadcn/ui components; brand colors (#f07b26, #d4620f) used via design tokens. Lucide Icons for navigation/actions. |
| **IV. Next.js App Router** | ✅ PASS | Server components for data fetch; client components for forms/dialogs. Data access in `lib/` utilities; components remain focused on UI. |
| **V. Testing at All Levels** | ✅ PASS | Unit (component logic, utilities), Integration (server actions + Supabase), E2E (Playwright critical flows). Each story includes test plan. |

**No violations identified.** Feature aligns with all constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/004-sales-dashboard-ui-overhaul/
├── spec.md              # Feature specification
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0: Technical research & decisions
├── data-model.md        # Phase 1: Entity definitions & relationships
├── quickstart.md        # Phase 1: Developer setup & examples
├── contracts/           # Phase 1: API/DB contracts (if applicable)
│   └── quotation-approval-workflow.md
└── checklists/
    └── requirements.md
```

### Source Code Structure (in repository)

```text
app/
├── protected/
│   ├── layout.tsx           # Sidebar + main content layout
│   ├── sales/
│   │   ├── layout.tsx       # Sales tab layout
│   │   ├── page.tsx         # Sales dashboard index (redirects to first tab)
│   │   ├── clients/
│   │   │   ├── page.tsx     # Clients table page
│   │   │   └── actions.ts   # createClient, deleteClient server actions
│   │   ├── quotations/
│   │   │   ├── page.tsx     # Quotations table page
│   │   │   └── actions.ts   # submitQuotation, approveQuotation, rejectQuotation actions
│   │   └── purchase-orders/
│   │       ├── page.tsx     # Purchase orders table page
│   │       └── actions.ts   # createPO, recordCollection actions

components/
├── layouts/
│   ├── sidebar.tsx          # Persistent sidebar + hamburger toggle
│   └── dashboard-layout.tsx # Main content wrapper
├── dialogs/
│   ├── create-client-dialog.tsx
│   ├── client-details-dialog.tsx
│   ├── quotation-details-dialog.tsx
│   ├── create-po-dialog.tsx
│   └── record-collection-dialog.tsx
├── tables/
│   ├── clients-table.tsx
│   ├── quotations-table.tsx
│   └── purchase-orders-table.tsx
└── ui/
    └── [existing shadcn/ui components]

lib/
├── sales/
│   ├── clients.ts           # fetchClients, createClient service
│   ├── quotations.ts        # fetchQuotations, approveQuotation service
│   ├── purchase-orders.ts   # fetchPOs, recordCollection service
│   └── approval-workflow.ts # determineApprovalLevel, routeApproval utils
├── client-code-generator.ts # generateClientCode, validateClientCodeUniqueness
└── supabase/
    ├── client.ts
    ├── server.ts
    └── auth.ts

tests/
├── unit/
│   ├── client-code-generator.test.ts
│   ├── approval-workflow.test.ts
│   └── collection-validation.test.ts
├── integration/
│   ├── clients.test.ts
│   ├── quotations.test.ts
│   └── purchase-orders.test.ts
└── e2e/
    ├── sales-dashboard-layout.spec.ts
    ├── clients-create-search.spec.ts
    ├── quotations-approval-workflow.spec.ts
    └── purchase-orders-collection.spec.ts
```

**Structure Decision**: Feature integrates into existing `app/protected/sales/` structure with new subdirectories for clients, quotations, and purchase-orders. Shared dialog and table components in `components/` directory. Data access logic encapsulated in `lib/sales/` utilities. Test organization mirrors source structure: unit tests for business logic, integration tests for server actions + Supabase, E2E tests for critical user journeys.

---

## Phase 0: Research & Technical Decisions

### Research Topics (to be generated in `research.md`)

1. **Sidebar Navigation Patterns**: Best practices for persistent sidebar on desktop + responsive hamburger on mobile (Tailwind implementation, accessibility)
2. **Shadcn/ui Dialog & Table Components**: Feature set, customization options, form integration within dialogs
3. **Supabase RLS Policy Design**: Department-based filtering, role-based approval actions, concurrent update handling
4. **Client-Side Code Generation & Uniqueness**: Random generation algorithm, database constraint strategies (unique index + retry logic)
5. **Approval Workflow State Management**: Database schema for approval chain, status transitions, multi-role approval routing
6. **Collection Tracking & Validation**: Transactional guarantees, accumulated balance calculations, overflow prevention
7. **Toast Notification Implementation**: Shadcn/ui toast hook, auto-dismiss, error vs. success patterns
8. **E2E Testing with Playwright**: Responsive viewport testing, dialog interactions, form submissions with server actions

---

## Phase 1: Design & Contracts

### 1.1 Data Model (→ `data-model.md`)

**Entities to define**:

#### Client
- `id` (PK, UUID)
- `department_id` (FK, dept access control)
- `code` (UNIQUE, VARCHAR, format: C[6 digits])
- `name` (VARCHAR)
- `contact_person` (VARCHAR)
- `email` (VARCHAR)
- `phone` (VARCHAR)
- `address` (TEXT)
- `created_at` (TIMESTAMP)
- `created_by` (USER_ID)
- Relationships: Many quotations, many purchase orders

#### Quotation
- `id` (PK, UUID)
- `department_id` (FK)
- `client_id` (FK → Client)
- `amount` (DECIMAL, for approval routing)
- `status` (ENUM: Draft, Pending[SalesManager], Pending[Owner], Pending[Executive], Approved, Rejected)
- `approval_chain` (JSON, tracks which roles need to approve)
- `created_by` (USER_ID)
- `submitted_at` (TIMESTAMP, nullable, when submitted for approval)
- `created_at`, `updated_at` (TIMESTAMP)
- Relationships: Items (line items), approvals (audit trail)

#### QuotationApproval (Audit Trail)
- `id` (PK, UUID)
- `quotation_id` (FK → Quotation)
- `approved_by` (USER_ID)
- `role` (VARCHAR: sales_manager, owner, executive)
- `action` (ENUM: Approved, Rejected)
- `reason` (TEXT, optional, for rejections)
- `created_at` (TIMESTAMP)

#### PurchaseOrder
- `id` (PK, UUID)
- `department_id` (FK)
- `client_id` (FK → Client)
- `po_number` (UNIQUE, VARCHAR)
- `total_amount` (DECIMAL)
- `collected_amount` (DECIMAL, starts at 0, accumulates)
- `status` (ENUM: Draft, Active, Closed)
- `created_by` (USER_ID)
- `created_at`, `updated_at` (TIMESTAMP)
- Relationships: Items (line items), collections

#### Collection
- `id` (PK, UUID)
- `purchase_order_id` (FK → PurchaseOrder)
- `amount` (DECIMAL)
- `recorded_by` (USER_ID)
- `created_at` (TIMESTAMP)
- Relationship: Aggregated into PO's `collected_amount`

### 1.2 API/Database Contracts (→ `contracts/`)

#### Server Actions (Client → Server)
- `createClient(data: ClientForm)` → Client | Error
- `submitQuotationForApproval(quotationId: UUID)` → Quotation | Error
- `approveQuotation(quotationId: UUID, role: Role)` → Quotation | Error
- `rejectQuotation(quotationId: UUID, reason: string, role: Role)` → Quotation | Error
- `createPurchaseOrder(data: POForm)` → PurchaseOrder | Error
- `recordCollection(poId: UUID, amount: Decimal)` → PurchaseOrder | Error

#### RLS Policies
- **Clients table**: Users can view clients in their department; create limited to sales_staff+
- **Quotations table**: Users can view quotations in their department; create limited to sales_staff; approve limited to sales_manager/owner/executive based on role
- **Collections table**: Users can create collections for their department; view own + approvers' collections

### 1.3 Quickstart Guide (→ `quickstart.md`)

Examples for developers:
- How to create a client with auto-generated code
- How to submit a quotation and transition through approval states
- How to record a collection and verify balance accumulation
- How to test approval workflows with different roles

---

## Phase 2: Tasks & Implementation (→ `tasks.md`)

**Depends on**: Phase 1 design artifacts  
**Output**: Ordered tasks for implementation, generated by `/speckit.tasks` command

At this stage, the following task groups are anticipated:

1. **Infrastructure (Database & RLS)**
   - Create/update tables in `schema.sql` (Clients, Quotations, QuotationApproval, PurchaseOrders, Collections)
   - Define RLS policies for department-based access control
   - Create approval routing functions/triggers

2. **Layout & Navigation**
   - Build responsive Sidebar component (desktop + mobile hamburger)
   - Create main Dashboard layout wrapper
   - Wire up navigation between tabs

3. **Client Management**
   - Build clients table with filtering/search
   - Create "Create Client" dialog with code generation
   - Create "Client Details" read-only dialog
   - Implement `createClient` server action + validation

4. **Quotation Workflow**
   - Build quotations table with status filtering
   - Create quotation details dialog with approval chain visibility
   - Implement submit/approve/reject server actions
   - Add amount-based approval routing logic
   - Toast notifications for approval outcomes

5. **Purchase Orders & Collections**
   - Build purchase orders table
   - Create PO details dialog with collection history
   - Create "Record Collection" dialog with balance validation
   - Implement `recordCollection` server action with transaction safety

6. **Component & Dialog Polish**
   - Form validation (required fields, format constraints)
   - Error handling & user feedback (toasts, inline errors)
   - Empty states (no results from filter)
   - Loading states (table/dialog skeletons)

7. **Testing**
   - Unit tests (code generation, approval routing, collection validation)
   - Integration tests (server actions + Supabase, RLS enforcement)
   - E2E tests (Playwright: full user journeys, responsive testing)

8. **Documentation & QA**
   - Update API documentation
   - Prepare deployment checklist
   - Final QA pass on all browsers/viewports

---

## Complexity Tracking

**No constitution violations identified.** Feature design adheres to all principles:
- Schema-first via `schema.sql` updates
- Supabase Auth + RLS for authorization
- Consistent Tailwind + Shadcn/ui design
- Next.js App Router best practices
- Comprehensive test strategy

| Decision | Justification | Considered Alternatives |
|----------|---------------|------------------------|
| Client-side code generation (C[6 digits]) | Simplicity; no server roundtrip. Uniqueness enforced via DB constraint + retry. | Server-side sequential (more complex state) |
| In-app toast only (no email) | Faster feedback loop; reduced infrastructure. Suits collaborative dashboard use case. | Email notifications (deferred to future) |
| Table refresh on form submission (polling) | Simple, no WebSocket complexity. Acceptable for typical approval SLA. | Real-time WebSocket (overkill for this scope) |
| Amount-based approval routing | Critical business requirement; implements accrual controls. | Flat approval chain (less control) |

---

## Next Steps

1. Run `/speckit.plan` to [generate research.md](research.md), [data-model.md](data-model.md), and [quickstart.md](quickstart.md)
2. Review generated design artifacts for completeness and accuracy
3. Run `/speckit.tasks` to generate detailed task breakdown in [tasks.md](tasks.md)
4. Begin implementation with infrastructure & database setup (Phase 2, Task Group 1)


