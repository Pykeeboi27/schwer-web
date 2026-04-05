# Quickstart: Sales Module Dashboard

**Feature**: 003-sales-dashboard  
**Date**: 2026-04-05

## Prerequisites

- Node.js (LTS recommended)
- A Supabase project

## 1) Configure environment variables

Ensure `.env.local` contains:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### E2E variables (Sales flows)

Set these for Playwright coverage of Sales routes:

- `E2E_SALES_LOGIN_EMAIL`
- `E2E_SALES_LOGIN_PASSWORD`
- `E2E_OWNER_LOGIN_EMAIL`
- `E2E_OWNER_LOGIN_PASSWORD`

## 2) Apply database schema

- Apply `schema.sql` to your Supabase database.
- Confirm the Sales tables exist:
  - `public.clients`, `public.client_contacts`
  - `public.quotations`, `public.quotation_approvals`
  - `public.purchase_orders`, `public.po_payments`

### RLS reminder

- `schema.sql` enables RLS for Sales tables.
- This feature requires Sales-safe RLS policies (outlined in `plan.md`). Ensure your Supabase DB policies match the intended access control before going live.

## 3) Run the app

- Install dependencies: `npm install`
- Start dev server: `npm run dev`

## 4) Manual verification

### Sales dashboard navigation

- Sign in as a Sales user.
- Visit `/protected/sales`.
- Confirm you see the Sales sidebar tabs and a summary section.

### Client management

- Go to `/protected/sales/clients`.
- Create a client (company name + sector + payment terms days).
- Add a primary contact.
- Inactivate the client and confirm it is not selectable for new activity.

### Quotation approvals

- Go to `/protected/sales/quotations`.
- Create a quotation below ₱3,000,000 and confirm it requires Sales Manager approval.
- Create a quotation ≥ ₱3,000,000 and confirm it requires Sales Manager + Owner + Executive approval.

### Purchase orders + collections

- Go to `/protected/sales/purchase-orders`.
- Create a PO for a client.
- Record a PO payment.
- Confirm recognized sales totals increase and never exceed PO amount.
