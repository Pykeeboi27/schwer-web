# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server on port 3000
npm run build         # Production build
npm run lint          # ESLint
npm run test          # Unit + integration tests (Vitest)
npm run test:unit     # Unit tests only
npm run test:e2e      # Playwright E2E (requires E2E_* env vars)
```

Run a single test file:
```bash
npx vitest run tests/unit/approval-workflow.test.ts
```

## Architecture

**Stack**: Next.js App Router · Supabase (auth + database) · Tailwind CSS · shadcn/ui (New York style) · TypeScript strict mode

**Path alias**: `@/` maps to `./` (project root)

### App Router Structure

- `app/` — pages and layouts
  - `page.tsx` — public landing page
  - `auth/` — login, sign-up, confirm, choose-department, forgot-password (server actions in `auth/actions.ts`)
  - `protected/` — auth-gated dashboard with a shared layout and navigation
    - `sales/` — clients, quotations, purchase orders (tabbed workspace)
    - `executive/` — KPI dashboard, approvals (role-gated)

### Data Fetching

All data fetching is server-side using async Server Components. Use `createClient()` from `lib/supabase/server.ts` (never the client-side import) inside Server Components and Server Actions. Client components handle only UI state — sidebar toggle, theme, form fields.

Server Actions (React 19 `useActionState`) handle all mutations. Form state flows through `actions.ts` files co-located with their routes.

### Authentication & Profile Flow

1. Supabase cookie-based SSR sessions (no JWT in client)
2. After login → `ensureCurrentProfile()` creates a profile row if missing (self-healing)
3. No department set → redirect to `/auth/choose-department`
4. Department set → redirect to `/protected/{department}`

Profile and access utilities live in `lib/profile/`. Always call `getCurrentProfile()` at the top of protected page components and redirect if null.

### Access Control

Role checks are pure functions that return booleans or redirect paths — never throw. Location by domain:

- `lib/sales/access.ts` — `getSalesAccessRedirect(profile)`
- `lib/executive/access.ts` — `isExecutiveDashboardViewer(profile)`, `isTargetEditor(profile)`

Supabase RLS enforces row-level access at the database layer as a second line of defense.

### Approval Workflow

`lib/sales/approval-workflow.ts` implements the quotation state machine:

`draft → pending_sales_manager → pending_owner (if amount ≥ 3 M) → pending_executive → approved`

The key function is `determineNextQuotationStatus(currentStatus, role, amount)`. Amounts below 3 M skip the owner step. Terminal states are `approved` and `rejected`. This logic has unit tests in `tests/unit/approval-workflow.test.ts` — update those when changing thresholds or role rules.

### Component Organization

- `components/ui/` — shadcn/ui primitives (do not edit unless upgrading shadcn)
- `components/layouts/` — DashboardLayout, Sidebar (responsive)
- `components/dialogs/` — modal CRUD forms (Client, Quotation, PO)
- `components/executive/` — domain-specific components (ApprovalTable, TargetEditorForm)

### Testing

| Layer | Tool | Location |
|---|---|---|
| Unit | Vitest + jsdom | `tests/unit/` |
| Integration | Vitest + real Supabase | `tests/integration/` |
| E2E | Playwright (Chromium) | `tests/e2e/` |

E2E tests auto-start the dev server. Integration tests hit a real Supabase instance configured via `E2E_*` environment variables.

### Database

`schema.sql` is the canonical schema (1 400+ lines). Tables: `profiles`, `clients`, `client_contacts`, `quotations`, `purchase_orders`, `collections`, `targets`. All tables use RLS.

Domain logic helpers (aggregations, KPIs, period calculations) live in `lib/sales/` and `lib/executive/` and call Supabase directly — no ORM layer.
