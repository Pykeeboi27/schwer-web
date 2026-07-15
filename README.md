# Schwer Online Management

A department-first operations portal for Schwer PH — sales pipeline, engineering
costing, and executive oversight in one internal web app.

Built with [Next.js](https://nextjs.org) (App Router) and [Supabase](https://supabase.com)
(Postgres, Auth, Row-Level Security).

## Overview

Every employee signs in once and lands on the dashboard for their department.
Each module owns its own workflow, but they connect into one pipeline:

```
Engineering (costing)  →  Sales (pricing & approval)  →  Purchase Orders  →  Executive (oversight)
```

- **Engineering** prepares the direct cost for a quotation and submits it for
  executive costing approval.
- **Sales** adds margin/pricing on top of the approved cost, routes the
  quotation through approval (sales manager → owner → executive, based on
  amount), records the client's PO, and converts it into a purchase order with
  collections tracking.
- **Executive** reviews high-value quotation/PO approvals, approves costing
  submissions, sets revenue targets, and monitors company-wide KPIs.

`hr`, `accounting`, and `purchasing` are registered departments (users can
select them at sign-up and will land on a placeholder dashboard) but don't yet
have dedicated modules.

## Tech stack

| Layer      | Choice                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router, Server Components, Server Actions)               |
| Language   | TypeScript (strict mode)                                                 |
| Database   | Supabase Postgres, with Row-Level Security on every table                |
| Auth       | Supabase Auth via `@supabase/ssr` (cookie-based sessions)                |
| Styling    | Tailwind CSS                                                             |
| Components | shadcn/ui (New York style) on top of Radix primitives                    |
| Testing    | Vitest + Testing Library + jsdom                                         |
| Deployment | Docker (`output: "standalone"`), see `Dockerfile` / `docker-compose.yml` |

## Modules at a glance

| Route                                    | Who                     | What it does                                                                   |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `/protected/sales`                       | Sales                   | KPIs, sector performance, client distribution, quotation status breakdown      |
| `/protected/sales/clients`               | Sales                   | Client directory with generated client codes and contact details               |
| `/protected/sales/quotations`            | Sales                   | Quotation pipeline — ready-for-quotation, ready-for-PO, mine vs. company       |
| `/protected/sales/purchase-orders`       | Sales                   | Converted POs, payment collection, running recognized totals, worksheet export |
| `/protected/sales/approvals`             | Sales manager           | Quotations/POs pending sales-manager approval                                  |
| `/protected/engineering`                 | Engineering             | Costing status breakdown and recent submissions                                |
| `/protected/engineering/quotations`      | Engineering             | Draft and submit costing quotations for executive approval                     |
| `/protected/executive`                   | Executive/Owner viewers | Revenue vs. target, YTD margin, PO summary, yearly/quarterly target editing    |
| `/protected/executive/sales`             | Executive/Owner viewers | Revenue breakdown by period, sector/client charts, sales performance ranking   |
| `/protected/executive/approvals`         | Owner/Executive         | High-value (≥ ₱3M) quotation and PO approvals                                  |
| `/protected/executive/costing-approvals` | Executive               | Approve or reject engineering's costing submissions                            |

## Authentication & profile flow

1. Supabase cookie-based SSR sessions — no JWT is ever handled client-side.
2. After login, `ensureCurrentProfile()` self-heals by creating a `profiles`
   row if one doesn't exist yet.
3. No department set → redirected to `/auth/choose-department`.
4. Department set → redirected to `/protected/{department}`.

Access control is enforced twice: pure predicate functions in `lib/*/access.ts`
gate page rendering, and Postgres RLS policies gate the data itself.

## Quotation approval workflow

```
draft → pending_sales_manager → pending_owner (if amount ≥ ₱3M) → pending_executive → approved
```

Quotations under ₱3M skip the owner step. Terminal states are `approved` and
`rejected`; `closed` marks a quotation that's been converted into a purchase
order. The state machine lives in `lib/sales/approval-workflow.ts` and is unit
tested in `tests/unit/approval-workflow.test.ts`.

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase project](https://database.new) (or the Supabase CLI for local development)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable/anon key>

# Optional — enables in-app Google Drive uploads for quotation attachments.
# Without these, users can still paste a Drive link manually.
GOOGLE_SERVICE_ACCOUNT_JSON=<service account JSON, as a single-line string>
GOOGLE_DRIVE_FOLDER_ID=<target Drive folder ID>
```

Both Supabase values are in your project's API settings
(`https://supabase.com/dashboard/project/_?showConnect=true`).

### 3. Set up the database

Apply `schema.sql` to your Supabase project (via the SQL editor or
`supabase db push`). It creates every table (`profiles`, `clients`,
`client_contacts`, `quotations`, `quotation_approvals`, `purchase_orders`,
`po_approvals`, `po_payments`, `revenue_targets`, `audit_logs`), their RLS
policies, triggers, and helper functions.

### 4. Run the dev server

```bash
npm run dev
```

The app runs at [localhost:3000](http://localhost:3000).

## Available scripts

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Production build                 |
| `npm run start`        | Serve a production build         |
| `npm run lint`         | ESLint                           |
| `npm run format`       | Prettier check                   |
| `npm run format:write` | Prettier — write fixes           |
| `npm run test`         | Run the unit test suite (Vitest) |

Run a single test file with:

```bash
npx vitest run tests/unit/approval-workflow.test.ts
```

## Project structure

```
app/
  page.tsx                 # public landing page
  auth/                    # login, sign-up, confirm, choose-department, forgot-password
  protected/
    [department]/          # generic placeholder for departments without a module
    sales/                 # clients, quotations, purchase orders, approvals
    engineering/           # costing quotations
    executive/             # KPI dashboard, sales details, approvals, costing approvals
  api/                     # Drive upload proxy, PO worksheet export
components/
  ui/                      # shadcn/ui primitives (don't hand-edit — regenerate via shadcn)
  layouts/                 # DashboardLayout, Sidebar
  dialogs/                 # modal CRUD forms
  patterns/                # shared page/panel/table/status primitives
  sales/ · executive/ · engineering/ · tables/   # domain components
lib/
  sales/ · executive/ · engineering/ · profile/  # domain logic, calls Supabase directly (no ORM)
  supabase/                # server/client Supabase factory functions
tests/unit/                # Vitest suite, mirrors the lib/ and components/ structure
schema.sql                 # canonical database schema (tables, RLS, triggers, functions)
```

## Testing

Unit tests (Vitest + jsdom) are the only automated test layer, living in
`tests/unit/`. They cover domain logic (`lib/`), key components, and the
approval workflow state machine. Run the full suite with `npm run test`.

## Deployment

The app builds as a standalone Next.js output (`next.config.ts` sets
`output: "standalone"`) and ships with a `Dockerfile` and
`docker-compose.yml` for self-hosted deployment:

```bash
docker compose up --build
```

Environment variables are read from `.env.local` (see above) and passed
through as build args for the public Supabase values.
